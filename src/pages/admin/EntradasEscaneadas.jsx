import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import './EntradasEscaneadas.css';

const EntradasEscaneadas = () => {
  const { showAlert, showConfirm } = useAlert();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [entradas, setEntradas] = useState({ asientos: [], mesas: [], estadisticas: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eliminando, setEliminando] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const ITEMS_POR_PAGINA = 10;

  useEffect(() => {
    cargarEventos();
  }, []);

  useEffect(() => {
    const rol = (user?.rol || '').toLowerCase();
    if (rol && rol !== 'admin' && rol !== 'seguridad' && rol !== 'vendedor') {
      navigate('/admin', { replace: true });
    }
  }, [user?.rol, navigate]);

  useEffect(() => {
    if (eventoSeleccionado) {
      cargarEntradasEscaneadas();
    }
  }, [eventoSeleccionado]);

  const cargarEventos = async () => {
    try {
      const response = await api.get('/eventos');
      if (response.data.success) {
        setEventos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    }
  };

  const cargarEntradasEscaneadas = async () => {
    setLoading(true);
    setError('');
    setPaginaActual(1);
    try {
      const url = eventoSeleccionado 
        ? `/compras/entradas-escaneadas?evento_id=${eventoSeleccionado}`
        : '/compras/entradas-escaneadas';
      
      const response = await api.get(url);
      if (response.data.success) {
        setEntradas(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar entradas escaneadas:', error);
      setError('Error al cargar las entradas escaneadas');
    } finally {
      setLoading(false);
    }
  };

  const desmarcarEscaneo = async (entrada) => {
    const confirmado = await showConfirm('¿Estás seguro de desmarcar el escaneo de esta entrada?', { 
      type: 'warning',
      title: 'Desmarcar Escaneo'
    });
    if (!confirmado) {
      return;
    }

    setEliminando(entrada.codigo_escaneo);
    try {
      const response = await api.post('/compras/desmarcar-escaneo', {
        codigoEscaneo: entrada.codigo_escaneo,
        tipo: entrada.tipo,
        compra_asiento_id: entrada.compra_asiento_id,
        compra_mesa_id: entrada.compra_mesa_id,
        compra_entrada_general_id: entrada.compra_entrada_general_id
      });

      if (response.data.success) {
        // Recargar lista
        await cargarEntradasEscaneadas();
      }
    } catch (error) {
      console.error('Error al desmarcar escaneo:', error);
      showAlert(error.response?.data?.message || 'Error al desmarcar el escaneo', { type: 'error' });
    } finally {
      setEliminando(null);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const generales = Array.isArray(entradas.generales) ? entradas.generales : [];
  const todasLasEntradas = [...(entradas.asientos || []), ...(entradas.mesas || []), ...generales]
    .sort((a, b) => new Date(b.fecha_escaneo) - new Date(a.fecha_escaneo));

  // Paginación
  const totalPaginas = Math.ceil(todasLasEntradas.length / ITEMS_POR_PAGINA);
  const entradasPagina = todasLasEntradas.slice(
    (paginaActual - 1) * ITEMS_POR_PAGINA,
    paginaActual * ITEMS_POR_PAGINA
  );

  return (
    <div className="admin-page entradas-escaneadas-page">
      <div className="admin-content">
        <div className="escaneadas-header">
          <h1>✓ Entradas Escaneadas</h1>
          <p>Lista de todas las entradas que han sido escaneadas</p>
        </div>

        {/* Selector de evento */}
        <div className="selector-evento-escaneadas">
          <label>Filtrar por Evento:</label>
          <select
            value={eventoSeleccionado || ''}
            onChange={(e) => setEventoSeleccionado(e.target.value || null)}
            className="select-evento"
          >
            <option value="">-- Todos los eventos --</option>
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>
                {evento.titulo} - {evento.hora_inicio ? new Date(evento.hora_inicio).toLocaleDateString('es-ES') : ''}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Cargando...</div>
        ) : (
          <>
            {/* Estadísticas */}
            {entradas.estadisticas && (
              <div className="estadisticas-escaneadas">
                <div className="stat-card stat-card-primary">
                  <div className="stat-value">{entradas.estadisticas.total_confirmadas}</div>
                  <div className="stat-label">Total Confirmadas</div>
                  <div className="stat-subtitle">Entradas con pago confirmado</div>
                </div>
                <div className="stat-card stat-card-success">
                  <div className="stat-value">{entradas.estadisticas.total_escaneadas}</div>
                  <div className="stat-label">Total Escaneadas</div>
                  <div className="stat-subtitle">Entradas ya escaneadas</div>
                </div>
                <div className="stat-card stat-card-warning">
                  <div className="stat-value">{entradas.estadisticas.total_faltantes}</div>
                  <div className="stat-label">Faltantes por Escanear</div>
                  <div className="stat-subtitle">
                    {entradas.estadisticas.total_faltantes > 0 
                      ? `${Math.round((entradas.estadisticas.total_escaneadas / entradas.estadisticas.total_confirmadas) * 100)}% completado`
                      : '100% completado'}
                  </div>
                </div>
              </div>
            )}

            {/* Estadísticas detalladas */}
            {entradas.estadisticas && (
              <div className="estadisticas-detalladas">
                <h3>Desglose por Tipo</h3>
                <div className="estadisticas-grid">
                  {entradas.estadisticas.tipo_evento === 'general' ? (
                    <div className="stat-detail-card">
                      <h4>Evento General</h4>
                      <div className="stat-detail-row">
                        <span>Entradas Confirmadas:</span>
                        <strong>{entradas.estadisticas.generales?.total_confirmadas ?? entradas.estadisticas.generales?.vendidas ?? 0}</strong>
                      </div>
                      <div className="stat-detail-row">
                        <span>Entradas Escaneadas:</span>
                        <strong className="text-success">{entradas.estadisticas.generales?.total_escaneadas ?? entradas.estadisticas.generales?.escaneadas ?? 0}</strong>
                      </div>
                      <div className="stat-detail-row">
                        <span>Entradas Faltantes:</span>
                        <strong className="text-warning">{entradas.estadisticas.generales?.total_faltantes ?? 0}</strong>
                      </div>
                      <div className="stat-info-note">
                        <small>Los eventos generales no tienen asientos asignados. Se cuenta el total de entradas confirmadas.</small>
                      </div>
                    </div>
                  ) : (
                    <>
                      {entradas.estadisticas.generales && entradas.estadisticas.generales.total_confirmadas > 0 && (
                        <div className="stat-detail-card">
                          <h4>Entradas Generales</h4>
                          <div className="stat-detail-row">
                            <span>Entradas Confirmadas:</span>
                            <strong>{entradas.estadisticas.generales.total_confirmadas}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Entradas Escaneadas:</span>
                            <strong className="text-success">{entradas.estadisticas.generales.total_escaneadas ?? entradas.estadisticas.generales.escaneadas ?? 0}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Entradas Faltantes:</span>
                            <strong className="text-warning">{entradas.estadisticas.generales.total_faltantes ?? (entradas.estadisticas.generales.total_confirmadas - (entradas.estadisticas.generales.total_escaneadas ?? entradas.estadisticas.generales.escaneadas ?? 0))}</strong>
                          </div>
                        </div>
                      )}
                      {entradas.estadisticas.zonas_generales && entradas.estadisticas.zonas_generales.vendidas > 0 && (
                        <div className="stat-detail-card">
                          <h4>Personas de Pie (Zonas Generales)</h4>
                          <div className="stat-detail-row">
                            <span>Vendidas:</span>
                            <strong>{entradas.estadisticas.zonas_generales.vendidas}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Escaneadas:</span>
                            <strong className="text-success">{entradas.estadisticas.zonas_generales.escaneadas}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Faltantes:</span>
                            <strong className="text-warning">{entradas.estadisticas.zonas_generales.total_faltantes}</strong>
                          </div>
                          {entradas.estadisticas.zonas_generales.limite_total && (
                            <div className="stat-detail-row">
                              <span>Capacidad Total:</span>
                              <strong>{entradas.estadisticas.zonas_generales.limite_total}</strong>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="stat-detail-card">
                        <h4>Asientos Individuales</h4>
                        <div className="stat-detail-row">
                          <span>Confirmadas:</span>
                          <strong>{entradas.estadisticas.asientos.total_confirmadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Escaneadas:</span>
                          <strong className="text-success">{entradas.estadisticas.asientos.total_escaneadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Faltantes:</span>
                          <strong className="text-warning">{entradas.estadisticas.asientos.total_faltantes}</strong>
                        </div>
                      </div>
                      <div className="stat-detail-card">
                        <h4>🪑 Mesas Completas</h4>
                        <div className="stat-detail-row">
                          <span>Mesas Confirmadas:</span>
                          <strong>{entradas.estadisticas.mesas.vendidas ?? entradas.estadisticas.mesas.total_confirmadas ?? 0}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Mesas Escaneadas:</span>
                          <strong className="text-success">{entradas.estadisticas.mesas.escaneadas ?? entradas.estadisticas.mesas.total_escaneadas ?? 0}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Mesas Faltantes:</span>
                          <strong className="text-warning">{entradas.estadisticas.mesas.total_faltantes ?? 0}</strong>
                        </div>
                        {entradas.estadisticas.mesas.limite_total != null && (
                          <div className="stat-detail-row">
                            <span>Total Mesas Disponibles:</span>
                            <strong>{entradas.estadisticas.mesas.limite_total}</strong>
                          </div>
                        )}
                      </div>
                      <div className="stat-detail-card">
                        <h4>🎫 Sillas de Mesas (Entradas)</h4>
                        <div className="stat-detail-row">
                          <span>Total Sillas/Entradas:</span>
                          <strong>{entradas.estadisticas.mesas.sillas?.vendidas ?? entradas.estadisticas.mesas.sillas?.total_confirmadas ?? 0}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Sillas Escaneadas:</span>
                          <strong className="text-success">{entradas.estadisticas.mesas.sillas?.escaneadas ?? entradas.estadisticas.mesas.sillas?.total_escaneadas ?? 0}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Sillas Faltantes:</span>
                          <strong className="text-warning">{entradas.estadisticas.mesas.sillas?.total_faltantes ?? 0}</strong>
                        </div>
                        {entradas.estadisticas.mesas.sillas?.limite_total != null && (
                          <div className="stat-detail-row">
                            <span>Capacidad Total Sillas:</span>
                            <strong>{entradas.estadisticas.mesas.sillas.limite_total}</strong>
                          </div>
                        )}
                        <div className="stat-info-note">
                          <small>Cada mesa genera N entradas individuales según su cantidad de sillas. Ej: 3 mesas de 5 sillas = 15 entradas.</small>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Estadísticas básicas (si no hay estadísticas detalladas) */}
            {!entradas.estadisticas && (
              <div className="estadisticas-escaneadas">
                <div className="stat-card">
                  <div className="stat-value">{todasLasEntradas.length}</div>
                  <div className="stat-label">Total Escaneadas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{entradas.asientos.length}</div>
                  <div className="stat-label">Asientos</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{entradas.mesas.length}</div>
                  <div className="stat-label">Mesas</div>
                </div>
              </div>
            )}

            {/* Tabla de entradas escaneadas */}
            {todasLasEntradas.length === 0 ? (
              <div className="sin-entradas">
                <p>No hay entradas escaneadas{eventoSeleccionado ? ' para este evento' : ''}</p>
              </div>
            ) : (
              <div className="tabla-entradas-escaneadas">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo</th>
                      <th>Detalle</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Evento</th>
                      <th>Escaneado Por</th>
                      <th>Fecha Escaneo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entradasPagina.map((entrada) => (
                      <tr key={`${entrada.tipo}-${entrada.id}`}>
                        <td><strong>{entrada.codigo_escaneo}</strong></td>
                        <td>
                          <span className={`badge-tipo ${entrada.tipo.toLowerCase()}`}>
                            {entrada.tipo === 'SILLA_MESA' ? 'SILLA' : entrada.tipo}
                          </span>
                        </td>
                        <td>
                          {entrada.tipo === 'ASIENTO' ? (
                            <>
                              Asiento: {entrada.numero_asiento}
                              {entrada.numero_mesa && ` (Mesa M${entrada.numero_mesa})`}
                              {entrada.tipo_precio_nombre && ` - ${entrada.tipo_precio_nombre}`}
                            </>
                          ) : entrada.tipo === 'SILLA_MESA' ? (
                            <>Silla de Mesa {entrada.codigo_mesa || entrada.numero_mesa ? `M${entrada.codigo_mesa || entrada.numero_mesa}` : ''}</>
                          ) : entrada.tipo === 'GENERAL' ? (
                            <>Entrada General{entrada.area_nombre ? ` (${entrada.area_nombre})` : ''}</>
                          ) : (
                            <>
                              Mesa {entrada.codigo_mesa || entrada.numero_mesa} ({entrada.cantidad_sillas} sillas)
                            </>
                          )}
                        </td>
                        <td>{entrada.cliente_nombre}</td>
                        <td>{entrada.cliente_telefono || '-'}</td>
                        <td>{entrada.evento_titulo}</td>
                        <td>{entrada.usuario_escaneo || '-'}</td>
                        <td>{formatearFecha(entrada.fecha_escaneo)}</td>
                        <td>
                          <button
                            className="btn-desmarcar"
                            onClick={() => desmarcarEscaneo(entrada)}
                            disabled={eliminando === entrada.codigo_escaneo}
                            title="Desmarcar escaneo para volver a escanear"
                          >
                            {eliminando === entrada.codigo_escaneo ? '...' : '🗑️ Desmarcar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="paginacion-entradas" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #ddd', background: paginaActual === 1 ? '#f0f0f0' : '#fff', cursor: paginaActual === 1 ? 'default' : 'pointer', fontWeight: 'bold' }}
                    >
                      ← Anterior
                    </button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 2)
                      .map((p, idx, arr) => (
                        <span key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '0 4px' }}>...</span>}
                          <button
                            onClick={() => setPaginaActual(p)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid', borderColor: p === paginaActual ? '#1976d2' : '#ddd', background: p === paginaActual ? '#1976d2' : '#fff', color: p === paginaActual ? '#fff' : '#333', cursor: 'pointer', fontWeight: p === paginaActual ? 'bold' : 'normal' }}
                          >
                            {p}
                          </button>
                        </span>
                      ))}
                    <button
                      onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #ddd', background: paginaActual === totalPaginas ? '#f0f0f0' : '#fff', cursor: paginaActual === totalPaginas ? 'default' : 'pointer', fontWeight: 'bold' }}
                    >
                      Siguiente →
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: '8px' }}>
                      Mostrando {(paginaActual - 1) * ITEMS_POR_PAGINA + 1}-{Math.min(paginaActual * ITEMS_POR_PAGINA, todasLasEntradas.length)} de {todasLasEntradas.length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EntradasEscaneadas;

