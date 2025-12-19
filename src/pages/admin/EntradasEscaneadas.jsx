import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './EntradasEscaneadas.css';

const EntradasEscaneadas = () => {
  const { showAlert, showConfirm } = useAlert();
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [entradas, setEntradas] = useState({ asientos: [], mesas: [], estadisticas: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eliminando, setEliminando] = useState(null);

  useEffect(() => {
    cargarEventos();
  }, []);

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
        compra_mesa_id: entrada.compra_mesa_id
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

  const todasLasEntradas = [...entradas.asientos, ...entradas.mesas];

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
                        <strong>{entradas.estadisticas.generales.total_confirmadas}</strong>
                      </div>
                      <div className="stat-detail-row">
                        <span>Entradas Escaneadas:</span>
                        <strong className="text-success">{entradas.estadisticas.generales.total_escaneadas}</strong>
                      </div>
                      <div className="stat-detail-row">
                        <span>Entradas Faltantes:</span>
                        <strong className="text-warning">{entradas.estadisticas.generales.total_faltantes}</strong>
                      </div>
                      <div className="stat-info-note">
                        <small>Los eventos generales no tienen asientos asignados. Se cuenta el total de entradas confirmadas.</small>
                      </div>
                    </div>
                  ) : (
                    <>
                      {entradas.estadisticas.generales && entradas.estadisticas.generales.total_confirmadas > 0 && (
                        <div className="stat-detail-card">
                          <h4>Eventos Generales</h4>
                          <div className="stat-detail-row">
                            <span>Entradas Confirmadas:</span>
                            <strong>{entradas.estadisticas.generales.total_confirmadas}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Entradas Escaneadas:</span>
                            <strong className="text-success">{entradas.estadisticas.generales.total_escaneadas}</strong>
                          </div>
                          <div className="stat-detail-row">
                            <span>Entradas Faltantes:</span>
                            <strong className="text-warning">{entradas.estadisticas.generales.total_faltantes}</strong>
                          </div>
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
                        <h4>Mesas Completas</h4>
                        <div className="stat-detail-row">
                          <span>Mesas Confirmadas:</span>
                          <strong>{entradas.estadisticas.mesas.total_confirmadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Mesas Escaneadas:</span>
                          <strong className="text-success">{entradas.estadisticas.mesas.total_escaneadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Mesas Faltantes:</span>
                          <strong className="text-warning">{entradas.estadisticas.mesas.total_faltantes}</strong>
                        </div>
                      </div>
                      <div className="stat-detail-card">
                        <h4>Sillas de Mesas</h4>
                        <div className="stat-detail-row">
                          <span>Sillas Confirmadas:</span>
                          <strong>{entradas.estadisticas.mesas.sillas.total_confirmadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Sillas Escaneadas:</span>
                          <strong className="text-success">{entradas.estadisticas.mesas.sillas.total_escaneadas}</strong>
                        </div>
                        <div className="stat-detail-row">
                          <span>Sillas Faltantes:</span>
                          <strong className="text-warning">{entradas.estadisticas.mesas.sillas.total_faltantes}</strong>
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
                      <th>Evento</th>
                      <th>Escaneado Por</th>
                      <th>Fecha Escaneo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todasLasEntradas.map((entrada) => (
                      <tr key={`${entrada.tipo}-${entrada.id}`}>
                        <td><strong>{entrada.codigo_escaneo}</strong></td>
                        <td>
                          <span className={`badge-tipo ${entrada.tipo.toLowerCase()}`}>
                            {entrada.tipo}
                          </span>
                        </td>
                        <td>
                          {entrada.tipo === 'ASIENTO' ? (
                            <>
                              Asiento: {entrada.numero_asiento}
                              {entrada.numero_mesa && ` (Mesa M${entrada.numero_mesa})`}
                              {entrada.tipo_precio_nombre && ` - ${entrada.tipo_precio_nombre}`}
                            </>
                          ) : (
                            <>
                              Mesa M{entrada.numero_mesa} ({entrada.cantidad_sillas} sillas)
                            </>
                          )}
                        </td>
                        <td>{entrada.cliente_nombre}</td>
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EntradasEscaneadas;

