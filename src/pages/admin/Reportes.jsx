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

  const construirDetalle = (compra) => {
    if (!compra) return '-';
    if (compra.detalle_compra) return compra.detalle_compra;

    if (reporte?.evento?.tipo_evento === 'especial') {
      const partes = [];
      if (compra.mesas?.length) {
        const listaMesas = compra.mesas
          .map((m) => `M${m.numero_mesa || m.mesa_id || m.id || ''}`)
          .join(', ');
        const totalSillas = compra.mesas.reduce(
          (acc, mesa) => acc + (mesa.cantidad_sillas || 0),
          0
        );
        partes.push(`Mesa(s) ${listaMesas} (${totalSillas} sillas)`);
      }
      if (compra.asientos?.length) {
        const listaAsientos = compra.asientos
          .map((a) => {
            const mesa = a.numero_mesa || a.mesa_id;
            return `${mesa ? `M${mesa}-` : ''}S${a.numero_asiento || a.asiento_id || ''}`;
          })
          .join(', ');
        partes.push(`Sillas: ${listaAsientos}`);
      }
      if (compra.areas_personas?.length) {
        const zonasLista = compra.areas_personas
          .map((ap) => `${ap.area_nombre || `Área ${ap.area_id}`}: ${ap.cantidad} p.`)
          .join(', ');
        partes.push(`Zonas generales: ${zonasLista}`);
      }
      return partes.join(' | ') || `${obtenerTotalEntradas(compra)} entrada(s)`;
    }

    return `${obtenerTotalEntradas(compra)} entrada(s) general`;
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
      const detalle = compra.detalle_compra || '';
      // Extraer tipos como "5 GENERAL", "3 VIP", etc.
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

  // Filtrar compras según los filtros seleccionados
  const comprasFiltradas = useMemo(() => {
    if (!reporte?.compras?.length) return [];
    
    return reporte.compras.filter((compra) => {
      // Filtro por tipo de pago
      if (filtroTipoPago !== 'todos') {
        if (filtroTipoPago === 'QR' && compra.tipo_pago !== 'QR') return false;
        if (filtroTipoPago === 'EFECTIVO' && compra.tipo_pago !== 'EFECTIVO') return false;
        if (filtroTipoPago === 'PASARELA_QR' && compra.tipo_pago !== 'PASARELA_QR') return false;
        if (filtroTipoPago === 'SIN_PAGO' && compra.tipo_pago) return false;
      }

      // Filtro por estado
      if (filtroEstado !== 'todos' && compra.estado !== filtroEstado) return false;

      // Filtro por tipo de entrada
      if (filtroTipoEntrada !== 'todos') {
        const detalle = (compra.detalle_compra || '').toUpperCase();
        if (!detalle.includes(filtroTipoEntrada.toUpperCase())) return false;
      }

      // Filtro por cliente (nombre o teléfono)
      if (filtroCliente.trim()) {
        const busqueda = filtroCliente.trim().toLowerCase();
        const busqNum = busqueda.replace(/[^\d]/g, '');
        const nombre = (compra.cliente_nombre || '').toLowerCase();
        const telefono = (compra.cliente_telefono || '').replace(/[^\d]/g, '');
        const email = (compra.cliente_email || '').toLowerCase();
        const codigo = (compra.codigo_unico || '').toLowerCase();
        
        const coincide = nombre.includes(busqueda) || 
                        (busqNum.length > 0 && telefono.includes(busqNum)) ||
                        email.includes(busqueda) ||
                        codigo.includes(busqueda);
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
      const response = await api.get(`/reportes/exportar/${eventoSeleccionado}?formato=${formato}`);
      
      if (response.data.success && response.data.data?.url) {
        // El backend devuelve una URL relativa, construir la URL completa
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
        <h1>Reportes</h1>
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

        {/* Filtros de la tabla */}
        {!loadingReporte && reporte && (
          <div className="reportes-filtros-tabla">
            <div className="campo campo-busqueda">
              <label>🔍 Buscar cliente</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Nombre, teléfono, email o código..."
                  style={{ flex: 1 }}
                />
                {filtroCliente && (
                  <button
                    type="button"
                    onClick={() => setFiltroCliente('')}
                    style={{
                      padding: '0 10px',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="campo">
              <label>Tipo de pago</label>
              <select
                value={filtroTipoPago}
                onChange={(e) => setFiltroTipoPago(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="QR">📱 QR (Manual)</option>
                <option value="EFECTIVO">Solo Efectivo</option>
                <option value="PASARELA_QR">Solo Pasarela QR</option>
                <option value="SIN_PAGO">Sin pago</option>
              </select>
            </div>

            <div className="campo">
              <label>Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="PAGO_REALIZADO">Pago realizado</option>
                <option value="PAGO_PENDIENTE">Pago pendiente</option>
                <option value="ENTRADA_USADA">Entrada usada</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            {tiposEntradaDisponibles.length > 0 && (
              <div className="campo">
                <label>Tipo de entrada</label>
                <select
                  value={filtroTipoEntrada}
                  onChange={(e) => setFiltroTipoEntrada(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {tiposEntradaDisponibles.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn-limpiar-filtros"
              onClick={() => {
                setFiltroTipoPago('todos');
                setFiltroTipoEntrada('todos');
                setFiltroEstado('todos');
                setFiltroCliente('');
              }}
              title="Limpiar filtros"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {!loadingReporte && reporte && (
          <>
            <div className="resumen-cards">
              <div className="card-resumen">
                <span className="card-label">Compradores</span>
                <strong className="card-value">{reporte.resumen?.total_compras || 0}</strong>
                <span className="card-sub">Registros en el evento</span>
              </div>
              <div className="card-resumen">
                <span className="card-label">Ventas Realizadas</span>
                <strong className="card-value">
                  {reporte.resumen?.pagos_realizados || 0}
                </strong>
                <span className="card-sub">Entradas confirmadas</span>
              </div>
              <div className="card-resumen card-entradas-total">
                <span className="card-label">Entradas totales</span>
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
                      ? 'Mesas / sillas asignadas'
                      : 'Entradas generales'}
                  </span>
                )}
              </div>
              <div className="card-resumen card-qr">
                <span className="card-label">📱 Pagos QR</span>
                <strong className="card-value">
                  Bs. {parseFloat(reporte.resumen?.total_qr || 0).toFixed(2)}
                </strong>
                <span className="card-sub">
                  {reporte.resumen?.pagos_qr || 0} venta(s)
                </span>
              </div>
              <div className="card-resumen card-qr">
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
              {(reporte.resumen?.entradas_zonas_generales || 0) > 0 && (
                <div className="card-resumen card-zonas-generales">
                  <span className="card-label">🚶 Zonas generales (personas de pie)</span>
                  <strong className="card-value">
                    {reporte.resumen.entradas_zonas_generales}
                  </strong>
                  <span className="card-sub">
                    {reporte.resumen.entradas_zonas_generales_confirmadas || 0} confirmadas,{' '}
                    {reporte.resumen.entradas_zonas_generales_pendientes || 0} pendientes
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
                            <span>{construirDetalle(compra)}</span>
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

