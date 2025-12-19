import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
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
      const response = await api.get(`/reportes/evento/${eventoId}`);
      if (response.data.success) {
        setReporte(response.data.data);
      } else {
        setReporte(null);
        setError(response.data.message || 'No se pudo obtener el reporte');
      }
    } catch (err) {
      console.error('Error al cargar reporte:', err);
      setReporte(null);
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

