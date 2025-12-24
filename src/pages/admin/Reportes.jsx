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

  useEffect(() => {
    cargarEventos();
  }, []);

  useEffect(() => {
    if (eventoSeleccionado) {
      cargarReporte(eventoSeleccionado);
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
      return asientos + sillasMesas || compra.cantidad || 0;
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

        {!loadingReporte && reporte && (
          <>
            <div className="resumen-cards">
              <div className="card-resumen">
                <span className="card-label">Compradores</span>
                <strong className="card-value">{reporte.resumen?.total_compras || 0}</strong>
                <span className="card-sub">Registros en el evento</span>
              </div>
              <div className="card-resumen">
                <span className="card-label">Pagos confirmados</span>
                <strong className="card-value">
                  {reporte.resumen?.pagos_realizados || 0}
                </strong>
                <span className="card-sub">Entradas listas</span>
              </div>
              <div className="card-resumen">
                <span className="card-label">Pagos pendientes</span>
                <strong className="card-value">
                  {reporte.resumen?.pagos_pendientes || 0}
                </strong>
                <span className="card-sub">Por confirmar</span>
              </div>
              <div className="card-resumen">
                <span className="card-label">Entradas totales</span>
                <strong className="card-value">{resumenEntradas.total}</strong>
                <span className="card-sub">
                  {reporte.evento?.tipo_evento === 'especial'
                    ? 'Mesas / sillas asignadas'
                    : 'Entradas generales'}
                </span>
              </div>
            </div>

            {/* Estadísticas de ventas y disponibilidad */}
            {estadisticas && (
              <div className="estadisticas-ventas">
                <h3>Estadísticas de Ventas y Disponibilidad</h3>
                <div className="estadisticas-grid">
                  {/* Para eventos generales */}
                  {estadisticas.tipo_evento === 'general' && estadisticas.generales && (
                    <div className="stat-card-detail">
                      <h4>Entradas Generales</h4>
                      <div className="stat-row">
                        <span>Límite total:</span>
                        <strong>{estadisticas.generales.limite_total !== null ? estadisticas.generales.limite_total : 'Sin límite'}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Vendidas:</span>
                        <strong className="text-primary">{estadisticas.generales.vendidas}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Disponibles:</span>
                        <strong className={estadisticas.generales.disponibles !== null && estadisticas.generales.disponibles < 10 ? 'text-warning' : 'text-success'}>
                          {estadisticas.generales.disponibles !== null ? estadisticas.generales.disponibles : '-'}
                        </strong>
                      </div>
                      <div className="stat-row">
                        <span>Escaneadas:</span>
                        <strong className="text-info">{estadisticas.generales.escaneadas}</strong>
                      </div>
                      {estadisticas.generales.limite_total !== null && (
                        <div className="stat-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${Math.min(100, (estadisticas.generales.vendidas / estadisticas.generales.limite_total) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="progress-text">
                            {Math.round((estadisticas.generales.vendidas / estadisticas.generales.limite_total) * 100)}% vendidas
                          </span>
                        </div>
                      )}
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
                  {reporte.compras?.length || 0} registros encontrados
                </span>
              </div>

              {reporte.compras?.length ? (
                <table className="tabla-reportes">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Entradas</th>
                      <th>Detalle</th>
                      <th>Compra</th>
                      <th>Confirmación</th>
                      <th>Estado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.compras.map((compra) => {
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
                          <td>{getEstadoBadge(compra.estado)}</td>
                          <td className="centrado">
                            ${parseFloat(compra.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="sin-datos">No hay compras registradas para este evento.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reportes;

