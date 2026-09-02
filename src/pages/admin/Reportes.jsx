import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { getServerBase } from '../../api/base';
import './Reportes.css';
import './AdminLayout.css';

const estadosMapa = {
  PAGO_PENDIENTE: { label: 'Pago pendiente', clase: 'estado-pendiente' },
  PAGO_REALIZADO: { label: 'Pago realizado', clase: 'estado-realizado' },
  ENTRADA_USADA: { label: 'Entrada usada', clase: 'estado-usada' },
  CANCELADO: { label: 'Cancelado', clase: 'estado-cancelado' }
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const normalizarTelefono = (telefono) => (telefono || '').replace(/[^\d]/g, '');

const Reportes = () => {
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState('');
  const [reporte, setReporte] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtroTipoPago, setFiltroTipoPago] = useState('todos');
  const [filtroTipoEntrada, setFiltroTipoEntrada] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCliente, setFiltroCliente] = useState('');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 10;

  useEffect(() => {
    cargarEventos();
  }, []);

  useEffect(() => {
    if (eventoSeleccionado) {
      cargarReporte(eventoSeleccionado);
      // Resetear filtros y paginación al cambiar de evento
      setFiltroTipoPago('todos');
      setFiltroTipoEntrada('todos');
      setFiltroEstado('todos');
      setFiltroCliente('');
      setPaginaActual(1);
    }
  }, [eventoSeleccionado]);

  const cargarEventos = async () => {
    setLoadingEventos(true);
    setError('');
    try {
      const response = await api.get('/reportes/eventos');
      if (response.data.success) {
        const lista = response.data.data || [];
        const ordenada = [...lista].sort(
          (a, b) => new Date(a.hora_inicio).getTime() - new Date(b.hora_inicio).getTime()
        );
        setEventos(ordenada);

        const proximoHabilitado = ordenada.find((ev) => ev.habilitado);
        const primero = proximoHabilitado || ordenada[0];
        if (primero) {
          setEventoSeleccionado(String(primero.id));
        }
      } else {
        setError('No se pudieron cargar los eventos');
      }
    } catch (err) {
      console.error('Error al cargar eventos:', err);
      setError(err.response?.data?.message || 'Error al cargar los eventos');
    } finally {
      setLoadingEventos(false);
    }
  };

  const cargarReporte = async (eventoId) => {
    setLoadingReporte(true);
    setError('');
    try {
      // Cargar reporte y estadísticas en paralelo
      const [reporteResponse, estadisticasResponse] = await Promise.all([
        api.get(`/reportes/evento/${eventoId}`),
        api.get(`/compras/entradas-escaneadas?evento_id=${eventoId}`)
      ]);

      if (reporteResponse.data.success) {
        setReporte(reporteResponse.data.data);
      } else {
        setReporte(null);
        setError(reporteResponse.data.message || 'No se pudo obtener el reporte');
      }

      if (estadisticasResponse.data.success) {
        setEstadisticas(estadisticasResponse.data.data.estadisticas);
      } else {
        setEstadisticas(null);
      }
    } catch (err) {
      console.error('Error al cargar reporte:', err);
      setReporte(null);
      setEstadisticas(null);
      setError(err.response?.data?.message || 'Error al obtener el reporte');
    } finally {
      setLoadingReporte(false);
    }
  };

  const getEstadoBadge = (estado) => {
    const info = estadosMapa[estado] || { label: estado, clase: 'estado-default' };
    return <span className={`estado-chip ${info.clase}`}>{info.label}</span>;
  };

  const obtenerTotalEntradas = (compra) => {
    if (!compra) return 0;
    if (typeof compra.total_entradas === 'number') return compra.total_entradas;

    if (reporte?.evento?.tipo_evento === 'especial') {
      const asientos = compra.asientos?.length || 0;
      const sillasMesas = (compra.mesas || []).reduce(
        (acc, mesa) => acc + (mesa.cantidad_sillas || 0),
        0
      );
      const personasAreas = (compra.areas_personas || []).reduce(
        (acc, ap) => acc + (ap.cantidad || 0),
        0
      );
      return asientos + sillasMesas + personasAreas || compra.cantidad || 0;
    }

    return compra.cantidad || 0;
  };

  // Renderizador visual elegante y sombreado para el Detalle de compra
  const renderDetalleVisual = (compra) => {
    if (!compra) return <span className="detalle-empty">-</span>;

    const items = [];

    // 1. Mesas completas
    if (compra.mesas?.length > 0) {
      compra.mesas.forEach((m, idx) => {
        const mesaCod = m.codigo_mesa || m.numero_mesa || m.mesa_id;
        items.push(
          <div key={`mesa-${idx}`} className="detalle-pill detalle-pill-mesa">
            <span className="detalle-pill-icon">🍽️</span>
            <span className="detalle-pill-title">Mesa <strong>{mesaCod}</strong></span>
            {m.area_nombre && (
              <span className="detalle-pill-area">📍 {m.area_nombre}</span>
            )}
            {m.cantidad_sillas && (
              <span className="detalle-pill-badge">{m.cantidad_sillas} sillas</span>
            )}
          </div>
        );
      });
    }

    // 2. Sillas individuales
    if (compra.asientos?.length > 0) {
      const porMesa = {};
      const sinMesa = [];

      compra.asientos.forEach((a) => {
        const codMesa = a.codigo_mesa || (a.numero_mesa ? `M${a.numero_mesa}` : null);
        if (codMesa) {
          if (!porMesa[codMesa]) porMesa[codMesa] = { mesa: codMesa, area: a.area_nombre, sillas: [] };
          porMesa[codMesa].sillas.push(a.numero_asiento || a.asiento_id);
        } else {
          sinMesa.push(a);
        }
      });

      Object.values(porMesa).forEach((g, idx) => {
        items.push(
          <div key={`asiento-grp-${idx}`} className="detalle-pill detalle-pill-silla">
            <span className="detalle-pill-icon">🪑</span>
            <span className="detalle-pill-title">Sillas: <strong>{g.sillas.join(', ')}</strong></span>
            <span className="detalle-pill-context">(Mesa {g.mesa})</span>
            {g.area && <span className="detalle-pill-area">📍 {g.area}</span>}
          </div>
        );
      });

      if (sinMesa.length > 0) {
        items.push(
          <div key="asientos-sin-mesa" className="detalle-pill detalle-pill-silla">
            <span className="detalle-pill-icon">🪑</span>
            <span className="detalle-pill-title">Sillas: <strong>{sinMesa.map(a => a.numero_asiento || a.asiento_id).join(', ')}</strong></span>
            {sinMesa[0]?.area_nombre && <span className="detalle-pill-area">📍 {sinMesa[0].area_nombre}</span>}
          </div>
        );
      }
    }

    // 3. Áreas generales (personas de pie)
    if (compra.areas_personas?.length > 0) {
      compra.areas_personas.forEach((ap, idx) => {
        items.push(
          <div key={`area-${idx}`} className="detalle-pill detalle-pill-general">
            <span className="detalle-pill-icon">🚶</span>
            <span className="detalle-pill-title"><strong>{ap.area_nombre || `Área ${ap.area_id}`}</strong></span>
            <span className="detalle-pill-badge">{ap.cantidad} pers.</span>
          </div>
        );
      });
    }

    // 4. Si no tiene estructuras (evento general o string fallback)
    if (items.length === 0) {
      if (compra.detalle_compra) {
        const parts = compra.detalle_compra.split(/[|,]/).map(p => p.trim()).filter(Boolean);
        return (
          <div className="detalle-items-container">
            {parts.map((p, idx) => (
              <div key={`det-p-${idx}`} className="detalle-pill detalle-pill-default">
                <span className="detalle-pill-icon">🎫</span>
                <span className="detalle-pill-title">{p}</span>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="detalle-pill detalle-pill-default">
          <span className="detalle-pill-icon">🎫</span>
          <span className="detalle-pill-title">{obtenerTotalEntradas(compra)} entrada(s)</span>
        </div>
      );
    }

    return <div className="detalle-items-container">{items}</div>;
  };

  const resumenEntradas = useMemo(() => {
    if (!reporte?.compras?.length) {
      return {
        total: 0,
        confirmadas: 0,
        pendientes: 0
      };
    }

    return reporte.compras.reduce(
      (acc, compra) => {
        const total = obtenerTotalEntradas(compra);
        acc.total += total;
        if (compra.estado === 'PAGO_REALIZADO' || compra.estado === 'ENTRADA_USADA') {
          acc.confirmadas += total;
        } else if (compra.estado === 'PAGO_PENDIENTE') {
          acc.pendientes += total;
        }
        return acc;
      },
      { total: 0, confirmadas: 0, pendientes: 0 }
    );
  }, [reporte]);

  // Extraer tipos de entrada únicos del detalle de las compras
  const tiposEntradaDisponibles = useMemo(() => {
    if (!reporte?.compras?.length) return [];
    const tipos = new Set();
    reporte.compras.forEach((compra) => {
      // De áreas generales
      if (compra.areas_personas?.length) {
        compra.areas_personas.forEach(ap => {
          if (ap.area_nombre) tipos.add(ap.area_nombre.toUpperCase());
        });
      }
      // De mesas
      if (compra.mesas?.length) {
        compra.mesas.forEach(m => {
          if (m.area_nombre) tipos.add(m.area_nombre.toUpperCase());
          if (m.tipo_precio_nombre) tipos.add(m.tipo_precio_nombre.toUpperCase());
        });
      }
      // De detalle_compra
      const detalle = compra.detalle_compra || '';
      const matches = detalle.match(/\d+\s+([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/g);
      if (matches) {
        matches.forEach((match) => {
          const tipo = match.replace(/^\d+\s+/, '').trim().toUpperCase();
          if (tipo && tipo !== 'ENTRADA(S)' && tipo !== 'ENTRADA(S) GENERAL') {
            tipos.add(tipo);
          }
        });
      }
    });
    return Array.from(tipos).sort();
  }, [reporte]);

  // Función para normalizar texto (sin tildes, minúsculas, espacios limpios)
  const normalizarTexto = (str) =>
    (str || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Filtrar compras según los filtros seleccionados
  const comprasFiltradas = useMemo(() => {
    if (!reporte?.compras?.length) return [];

    const termBusqueda = normalizarTexto(filtroCliente);
    const busqNum = (filtroCliente || '').replace(/[^\d]/g, '');

    return reporte.compras.filter((compra) => {
      // 1. Filtro por tipo de pago
      if (filtroTipoPago !== 'todos') {
        const tp = (compra.tipo_pago || '').toUpperCase();
        if (filtroTipoPago === 'PASARELA_QR') {
          if (!tp.includes('PASARELA') && tp !== 'PASARELA_QR') return false;
        } else if (filtroTipoPago === 'EFECTIVO') {
          if (!tp.includes('EFECTIVO')) return false;
        } else if (filtroTipoPago === 'QR') {
          if (tp !== 'QR' && tp !== 'QR_MANUAL' && tp !== 'MANUAL') return false;
        } else if (filtroTipoPago === 'SIN_PAGO') {
          if (tp && tp !== 'SIN_PAGO') return false;
        }
      }

      // 2. Filtro por estado
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'PAGO_REALIZADO') {
          // Si eligen pago realizado, incluir también ENTRADA_USADA ya que son ventas pagadas y confirmadas
          if (compra.estado !== 'PAGO_REALIZADO' && compra.estado !== 'ENTRADA_USADA') return false;
        } else if (compra.estado !== filtroEstado) {
          return false;
        }
      }

      // 3. Filtro por tipo de entrada / zona
      if (filtroTipoEntrada !== 'todos') {
        const zonaBuscada = normalizarTexto(filtroTipoEntrada);
        const detalle = normalizarTexto(compra.detalle_compra);

        const tieneMesaZona = (compra.mesas || []).some(m => 
          normalizarTexto(m.area_nombre).includes(zonaBuscada) ||
          normalizarTexto(m.tipo_precio_nombre).includes(zonaBuscada)
        );
        const tieneAsientoZona = (compra.asientos || []).some(a => 
          normalizarTexto(a.area_nombre).includes(zonaBuscada)
        );
        const tieneAreaPersonaZona = (compra.areas_personas || []).some(ap => 
          normalizarTexto(ap.area_nombre).includes(zonaBuscada)
        );

        if (!detalle.includes(zonaBuscada) && !tieneMesaZona && !tieneAsientoZona && !tieneAreaPersonaZona) {
          return false;
        }
      }

      // 4. Búsqueda por cliente / ubicación / mesa / código / teléfono / zona
      if (termBusqueda) {
        const nombre = normalizarTexto(compra.cliente_nombre);
        const telefono = (compra.cliente_telefono || '').replace(/[^\d]/g, '');
        const email = normalizarTexto(compra.cliente_email);
        const codigo = normalizarTexto(compra.codigo_unico);
        const detalle = normalizarTexto(compra.detalle_compra);
        const idCompra = String(compra.id || '');

        // Buscar en mesas
        const tieneMesa = (compra.mesas || []).some(m => 
          normalizarTexto(m.codigo_mesa).includes(termBusqueda) ||
          normalizarTexto(`mesa ${m.codigo_mesa}`).includes(termBusqueda) ||
          String(m.numero_mesa || '').includes(termBusqueda) ||
          normalizarTexto(`mesa ${m.numero_mesa}`).includes(termBusqueda) ||
          normalizarTexto(m.area_nombre).includes(termBusqueda) ||
          normalizarTexto(m.tipo_precio_nombre).includes(termBusqueda)
        );

        // Buscar en asientos
        const tieneAsiento = (compra.asientos || []).some(a => 
          normalizarTexto(a.numero_asiento).includes(termBusqueda) ||
          normalizarTexto(`silla ${a.numero_asiento}`).includes(termBusqueda) ||
          normalizarTexto(a.codigo_mesa).includes(termBusqueda) ||
          String(a.numero_mesa || '').includes(termBusqueda) ||
          normalizarTexto(a.area_nombre).includes(termBusqueda)
        );

        // Buscar en áreas generales de personas
        const tieneArea = (compra.areas_personas || []).some(ap => 
          normalizarTexto(ap.area_nombre).includes(termBusqueda) ||
          normalizarTexto(`area ${ap.area_nombre}`).includes(termBusqueda)
        );

        const coincide = nombre.includes(termBusqueda) ||
                        (busqNum.length >= 3 && telefono.includes(busqNum)) ||
                        email.includes(termBusqueda) ||
                        codigo.includes(termBusqueda) ||
                        idCompra.includes(termBusqueda) ||
                        detalle.includes(termBusqueda) ||
                        tieneMesa || tieneAsiento || tieneArea;

        if (!coincide) return false;
      }

      return true;
    });
  }, [reporte, filtroTipoPago, filtroTipoEntrada, filtroEstado, filtroCliente]);

  // Paginación
  const totalPaginas = Math.ceil(comprasFiltradas.length / registrosPorPagina);
  const comprasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    return comprasFiltradas.slice(inicio, inicio + registrosPorPagina);
  }, [comprasFiltradas, paginaActual]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroTipoPago, filtroTipoEntrada, filtroEstado, filtroCliente]);

  const estadoEventoActual = reporte?.evento?.habilitado ? 'Habilitado' : 'Finalizado';

  const buildWhatsAppLink = (telefono, nombre, eventoTitulo) => {
    const tel = normalizarTelefono(telefono);
    if (!tel) return null;
    const mensaje = encodeURIComponent(
      `Hola ${nombre || ''}, te contacto sobre tus entradas para ${eventoTitulo || ''}`
    );
    return `https://wa.me/${tel}?text=${mensaje}`;
  };

  const exportarReporte = async (formato) => {
    if (!eventoSeleccionado) {
      return;
    }

    try {
      // Enviar los IDs exactos de las compras filtradas en pantalla
      const compraIds = (comprasFiltradas || []).map((c) => c.id);
      const response = await api.post(`/reportes/exportar/${eventoSeleccionado}`, {
        formato,
        compra_ids: compraIds
      });
      
      if (response.data.success && response.data.data?.url) {
        const urlRelativa = response.data.data.url;
        const serverBase = getServerBase();
        const urlCompleta = serverBase ? `${serverBase}${urlRelativa}` : urlRelativa;
        
        const link = document.createElement('a');
        link.href = urlCompleta;
        
        const eventoNombre = reporte?.evento?.titulo || 'reporte';
        const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
        link.download = `reporte_${eventoNombre.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('No se pudo generar el reporte. Por favor, intenta nuevamente.');
      }
    } catch (err) {
      console.error('Error al exportar reporte:', err);
      alert('Error al exportar el reporte. Por favor, intenta nuevamente.');
    }
  };

  return (
    <div className="admin-page reportes-page">
      <div className="admin-content">
        <div className="reportes-header">
          <div>
            <h1>Reportes de Ventas</h1>
            <p>Selecciona un evento para ver quién compró y el estado de sus entradas.</p>
          </div>
          <div className={`estado-evento ${reporte?.evento?.habilitado ? 'habilitado' : 'finalizado'}`}>
            {reporte ? estadoEventoActual : 'Sin evento'}
          </div>
        </div>

        <div className="reportes-filtros">
          <div className="campo">
            <label>Evento</label>
            <select
              value={eventoSeleccionado}
              onChange={(e) => setEventoSeleccionado(e.target.value)}
              disabled={loadingEventos}
            >
              <option value="" disabled>
                Selecciona un evento
              </option>
              {eventos.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {evento.titulo} · {formatearFecha(evento.hora_inicio)}{' '}
                  {evento.habilitado ? '(Habilitado)' : '(Finalizado)'}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-primario"
            onClick={() => eventoSeleccionado && cargarReporte(eventoSeleccionado)}
            disabled={!eventoSeleccionado || loadingReporte}
          >
            {loadingReporte ? 'Actualizando...' : 'Actualizar'}
          </button>
          {eventoSeleccionado && reporte && (
            <>
              <button
                className="btn-export-excel"
                onClick={() => exportarReporte('excel')}
                disabled={loadingReporte}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Exportar a Excel"
              >
                📊 Excel
              </button>
              <button
                className="btn-export-pdf"
                onClick={() => exportarReporte('pdf')}
                disabled={loadingReporte}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Exportar a PDF"
              >
                📄 PDF
              </button>
            </>
          )}
        </div>

        {error && <div className="mensaje-error">{error}</div>}

        {loadingReporte && <div className="loading">Cargando reporte...</div>}

        {/* Barra de Búsqueda y Filtros de Clientes para Eventos Especiales y Generales */}
        {!loadingReporte && reporte && (
          <div className="reportes-toolbar-busqueda">
            <div className="toolbar-campo-input">
              <label>🔍 Buscar cliente / ubicación</label>
              <div className="input-busqueda-wrapper">
                <input
                  type="text"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Nombre, teléfono, código, mesa (ej: A56), zona..."
                  className="input-buscar-cliente"
                />
                {filtroCliente && (
                  <button
                    type="button"
                    onClick={() => setFiltroCliente('')}
                    className="btn-clear-input"
                    title="Limpiar texto"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="toolbar-campo-select">
              <label>Tipo de pago</label>
              <select
                value={filtroTipoPago}
                onChange={(e) => setFiltroTipoPago(e.target.value)}
              >
                <option value="todos">Todos los pagos</option>
                <option value="PASARELA_QR">💳 Pasarela QR</option>
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="QR">📱 QR (Manual)</option>
                <option value="SIN_PAGO">Sin pago</option>
              </select>
            </div>

            <div className="toolbar-campo-select">
              <label>Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="PAGO_REALIZADO">✅ Pago realizado</option>
                <option value="PAGO_PENDIENTE">⏳ Pago pendiente</option>
                <option value="ENTRADA_USADA">🎟️ Entrada usada</option>
                <option value="CANCELADO">❌ Cancelado</option>
              </select>
            </div>

            {tiposEntradaDisponibles.length > 0 && (
              <div className="toolbar-campo-select">
                <label>Zona / Tipo de entrada</label>
                <select
                  value={filtroTipoEntrada}
                  onChange={(e) => setFiltroTipoEntrada(e.target.value)}
                >
                  <option value="todos">Todas las zonas / tipos</option>
                  {tiposEntradaDisponibles.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="toolbar-acciones">
              <button
                className="btn-aplicar-filtros"
                onClick={() => setPaginaActual(1)}
                title="Aplicar filtros de búsqueda"
              >
                🔍 Buscar cliente
              </button>
              {(filtroCliente || filtroTipoPago !== 'todos' || filtroEstado !== 'todos' || filtroTipoEntrada !== 'todos') && (
                <button
                  className="btn-limpiar-filtros"
                  onClick={() => {
                    setFiltroTipoPago('todos');
                    setFiltroTipoEntrada('todos');
                    setFiltroEstado('todos');
                    setFiltroCliente('');
                  }}
                  title="Limpiar todos los filtros"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {!loadingReporte && reporte && (
          <>
            {/* Tarjetas de Resumen Limpias (Sin "Compradores" ni "Ventas Realizadas" redundantes) */}
            <div className="resumen-cards">
              <div className="card-resumen card-entradas-total">
                <span className="card-label">🎟️ Entradas totales</span>
                <strong className="card-value">{resumenEntradas.total}</strong>
                {estadisticas?.desglose_tipos?.length > 0 ? (
                  <div className="desglose-mini">
                    {estadisticas.desglose_tipos.map((tipo, idx) => (
                      <span 
                        key={tipo.tipo_id} 
                        className={`desglose-badge desglose-color-${idx % 6}`}
                        title={`${tipo.nombre}: ${tipo.vendidas} vendidas`}
                      >
                        {tipo.vendidas} {tipo.nombre}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="card-sub">
                    {reporte.evento?.tipo_evento === 'especial'
                      ? 'Mesas, sillas y zonas generales'
                      : 'Entradas generales'}
                  </span>
                )}
              </div>

              <div className="card-resumen card-pasarela">
                <span className="card-label">💳 Pasarela QR</span>
                <strong className="card-value">
                  Bs. {parseFloat(reporte.resumen?.total_pasarela_qr || 0).toFixed(2)}
                </strong>
                <span className="card-sub">
                  {reporte.resumen?.pagos_pasarela_qr || 0} venta(s)
                </span>
              </div>

              <div className="card-resumen card-efectivo">
                <span className="card-label">💵 Pagos Efectivo</span>
                <strong className="card-value">
                  Bs. {parseFloat(reporte.resumen?.total_efectivo || 0).toFixed(2)}
                </strong>
                <span className="card-sub">
                  {reporte.resumen?.pagos_efectivo || 0} venta(s)
                </span>
              </div>

              {parseFloat(reporte.resumen?.total_qr || 0) > 0 && (
                <div className="card-resumen card-qr">
                  <span className="card-label">📱 Pagos QR (Manual)</span>
                  <strong className="card-value">
                    Bs. {parseFloat(reporte.resumen?.total_qr || 0).toFixed(2)}
                  </strong>
                  <span className="card-sub">
                    {reporte.resumen?.pagos_qr || 0} venta(s)
                  </span>
                </div>
              )}

              {(reporte.resumen?.entradas_zonas_generales || 0) > 0 && (
                <div className="card-resumen card-zonas-generales">
                  <span className="card-label">🚶 Zonas generales (personas)</span>
                  <strong className="card-value">
                    {reporte.resumen.entradas_zonas_generales}
                  </strong>
                  <span className="card-sub">
                    {reporte.resumen.entradas_zonas_generales_confirmadas || 0} confirmadas
                  </span>
                </div>
              )}
            </div>

            {/* Estadísticas de ventas y disponibilidad */}
            {estadisticas && (
              <div className="estadisticas-ventas">
                <h3>Estadísticas de Ventas y Disponibilidad</h3>
                <div className="estadisticas-grid">
                  {/* Desglose por tipo de entrada (VIP, General, Gradería, etc.) */}
                  {estadisticas.tipo_evento === 'general' && estadisticas.desglose_tipos?.length > 0 && (
                    <div className="stat-card-detail stat-card-wide">
                      <h4>Ventas por Tipo de Entrada</h4>
                      <div className="desglose-tipos-grid">
                        {estadisticas.desglose_tipos.map((tipo) => (
                          <div key={tipo.tipo_id} className="tipo-entrada-item">
                            <div className="tipo-entrada-header">
                              <span className="tipo-nombre">{tipo.nombre}</span>
                              <span className="tipo-precio">Bs. {tipo.precio.toFixed(2)}</span>
                            </div>
                            <div className="tipo-entrada-stats">
                              <div className="stat-mini">
                                <span className="stat-mini-label">Vendidas</span>
                                <strong className="text-primary">{tipo.vendidas}</strong>
                              </div>
                              <div className="stat-mini">
                                <span className="stat-mini-label">Escaneadas</span>
                                <strong className="text-info">{tipo.escaneadas}</strong>
                              </div>
                              <div className="stat-mini">
                                <span className="stat-mini-label">Disponibles</span>
                                <strong className={tipo.disponibles !== null && tipo.disponibles < 10 ? 'text-warning' : 'text-success'}>
                                  {tipo.disponibles !== null ? tipo.disponibles : 'Sin límite'}
                                </strong>
                              </div>
                            </div>
                            {tipo.limite !== null && (
                              <div className="stat-progress">
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ width: `${Math.min(100, (tipo.vendidas / tipo.limite) * 100)}%` }}
                                  ></div>
                                </div>
                                <span className="progress-text">
                                  {Math.round((tipo.vendidas / tipo.limite) * 100)}% vendidas ({tipo.vendidas}/{tipo.limite})
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Para eventos especiales */}
                  {estadisticas.tipo_evento === 'especial' && (
                    <>
                      {estadisticas.asientos && (
                        <div className="stat-card-detail">
                          <h4>Asientos Individuales</h4>
                          <div className="stat-row">
                            <span>Total disponibles:</span>
                            <strong>{estadisticas.asientos.limite_total !== null ? estadisticas.asientos.limite_total : '-'}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Vendidos:</span>
                            <strong className="text-primary">{estadisticas.asientos.vendidas}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Disponibles:</span>
                            <strong className={estadisticas.asientos.disponibles !== null && estadisticas.asientos.disponibles < 10 ? 'text-warning' : 'text-success'}>
                              {estadisticas.asientos.disponibles !== null ? estadisticas.asientos.disponibles : '-'}
                            </strong>
                          </div>
                          <div className="stat-row">
                            <span>Escaneados:</span>
                            <strong className="text-info">{estadisticas.asientos.escaneadas}</strong>
                          </div>
                        </div>
                      )}

                      {estadisticas.mesas && (
                        <>
                          <div className="stat-card-detail">
                            <h4>Mesas Completas</h4>
                            <div className="stat-row">
                              <span>Total disponibles:</span>
                              <strong>{estadisticas.mesas.limite_total !== null ? estadisticas.mesas.limite_total : '-'}</strong>
                            </div>
                            <div className="stat-row">
                              <span>Vendidas:</span>
                              <strong className="text-primary">{estadisticas.mesas.vendidas}</strong>
                            </div>
                            <div className="stat-row">
                              <span>Disponibles:</span>
                              <strong className={estadisticas.mesas.disponibles !== null && estadisticas.mesas.disponibles < 5 ? 'text-warning' : 'text-success'}>
                                {estadisticas.mesas.disponibles !== null ? estadisticas.mesas.disponibles : '-'}
                              </strong>
                            </div>
                            <div className="stat-row">
                              <span>Escaneadas:</span>
                              <strong className="text-info">{estadisticas.mesas.escaneadas}</strong>
                            </div>
                          </div>

                          {estadisticas.mesas.sillas && (
                            <div className="stat-card-detail">
                              <h4>Sillas (de Mesas)</h4>
                              <div className="stat-row">
                                <span>Total disponibles:</span>
                                <strong>{estadisticas.mesas.sillas.limite_total !== null ? estadisticas.mesas.sillas.limite_total : '-'}</strong>
                              </div>
                              <div className="stat-row">
                                <span>Vendidas:</span>
                                <strong className="text-primary">{estadisticas.mesas.sillas.vendidas}</strong>
                              </div>
                              <div className="stat-row">
                                <span>Disponibles:</span>
                                <strong className={estadisticas.mesas.sillas.disponibles !== null && estadisticas.mesas.sillas.disponibles < 10 ? 'text-warning' : 'text-success'}>
                                  {estadisticas.mesas.sillas.disponibles !== null ? estadisticas.mesas.sillas.disponibles : '-'}
                                </strong>
                              </div>
                              <div className="stat-row">
                                <span>Escaneadas:</span>
                                <strong className="text-info">{estadisticas.mesas.sillas.escaneadas}</strong>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {estadisticas.zonas_generales && (
                        <div className="stat-card-detail">
                          <h4>Zonas generales (personas de pie)</h4>
                          <div className="stat-row">
                            <span>Capacidad total:</span>
                            <strong>{estadisticas.zonas_generales.limite_total !== null ? estadisticas.zonas_generales.limite_total : '-'}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Vendidas:</span>
                            <strong className="text-primary">{estadisticas.zonas_generales.vendidas}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Disponibles:</span>
                            <strong className={estadisticas.zonas_generales.disponibles !== null && estadisticas.zonas_generales.disponibles < 10 ? 'text-warning' : 'text-success'}>
                              {estadisticas.zonas_generales.disponibles !== null ? estadisticas.zonas_generales.disponibles : '-'}
                            </strong>
                          </div>
                          <div className="stat-row">
                            <span>Escaneadas:</span>
                            <strong className="text-info">{estadisticas.zonas_generales.escaneadas}</strong>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Para eventos mixtos (vista general sin filtro) */}
                  {estadisticas.tipo_evento === 'mixto' && (
                    <div className="stat-card-detail">
                      <p className="text-muted">Selecciona un evento específico para ver estadísticas detalladas</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="tabla-wrapper">
              <div className="tabla-header">
                <h3>Compras del evento</h3>
                <span className="tabla-sub">
                  {comprasFiltradas.length === reporte.compras?.length
                    ? `${reporte.compras?.length || 0} registros`
                    : `${comprasFiltradas.length} de ${reporte.compras?.length || 0} registros (filtrados)`}
                </span>
              </div>

              {comprasFiltradas.length ? (
                <>
                <table className="tabla-reportes">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Entradas</th>
                      <th>Detalle</th>
                      <th>Compra</th>
                      <th>Confirmación</th>
                      <th>Tipo pago</th>
                      <th>Tipo venta</th>
                      <th>Estado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprasPaginadas.map((compra) => {
                      const whatsapp = buildWhatsAppLink(
                        compra.cliente_telefono,
                        compra.cliente_nombre,
                        reporte.evento?.titulo
                      );
                      return (
                        <tr key={compra.id}>
                          <td>
                            <div className="cliente">
                              <strong>{compra.cliente_nombre}</strong>
                              <span className="codigo">{compra.codigo_unico}</span>
                            </div>
                          </td>
                          <td>
                            <div className="telefono">
                              <span>{compra.cliente_telefono || 'Sin teléfono'}</span>
                              {whatsapp && (
                                <a
                                  href={whatsapp}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-whatsapp"
                                >
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="centrado">
                            <strong>{obtenerTotalEntradas(compra)}</strong>
                          </td>
                          <td className="detalle">
                            {renderDetalleVisual(compra)}
                          </td>
                          <td>{formatearFecha(compra.fecha_compra)}</td>
                          <td>{formatearFecha(compra.fecha_confirmacion || compra.fecha_pago)}</td>
                          <td>
                            {compra.tipo_pago ? (
                              <span className={`tipo-pago-badge tipo-pago-${compra.tipo_pago?.toLowerCase()}`}>
                                {compra.tipo_pago === 'QR' ? '📱 QR (Manual)' : compra.tipo_pago === 'PASARELA_QR' ? '💳 Pasarela QR' : '💵 Efectivo'}
                              </span>
                            ) : (
                              <span className="tipo-pago-badge tipo-pago-sin">-</span>
                            )}
                          </td>
                          <td>
                            {compra.tipo_venta === 'REGALO_ADMIN' ? (
                              <span className="tipo-venta-badge tipo-venta-regalo">🎁 Regalo Admin</span>
                            ) : compra.tipo_venta === 'OFERTA_ADMIN' ? (
                              <span className="tipo-venta-badge tipo-venta-oferta">🏷️ Oferta</span>
                            ) : (
                              <span className="tipo-venta-badge tipo-venta-normal">Venta normal</span>
                            )}
                          </td>
                          <td>{getEstadoBadge(compra.estado)}</td>
                          <td className="centrado">
                            {compra.tipo_venta === 'REGALO_ADMIN' ? (
                              <span style={{ color: '#28a745', fontWeight: 600 }}>Gratis</span>
                            ) : compra.tipo_venta === 'OFERTA_ADMIN' && compra.precio_original ? (
                              <span title={`Original: Bs. ${parseFloat(compra.precio_original).toFixed(2)}`}>
                                ${parseFloat(compra.total || 0).toFixed(2)}
                                <small style={{ display: 'block', color: '#888', fontSize: '0.8em' }}>
                                  (orig. ${parseFloat(compra.precio_original).toFixed(2)})
                                </small>
                              </span>
                            ) : (
                              `$${parseFloat(compra.total || 0).toFixed(2)}`
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="paginacion">
                    <button
                      className="btn-pag"
                      onClick={() => setPaginaActual(1)}
                      disabled={paginaActual === 1}
                      title="Primera página"
                    >
                      ««
                    </button>
                    <button
                      className="btn-pag"
                      onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      title="Página anterior"
                    >
                      «
                    </button>
                    <span className="pag-info">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <button
                      className="btn-pag"
                      onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                      title="Página siguiente"
                    >
                      »
                    </button>
                    <button
                      className="btn-pag"
                      onClick={() => setPaginaActual(totalPaginas)}
                      disabled={paginaActual === totalPaginas}
                      title="Última página"
                    >
                      »»
                    </button>
                  </div>
                )}
              </>
              ) : (
                <div className="sin-datos">
                  {reporte.compras?.length
                    ? 'No hay compras que coincidan con los filtros seleccionados.'
                    : 'No hay compras registradas para este evento.'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reportes;

