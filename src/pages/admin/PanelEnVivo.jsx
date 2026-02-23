import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import './PanelEnVivo.css';

const REFRESH_INTERVAL_MS = 15000; // 15 segundos

const PanelEnVivo = () => {
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargarEventos = useCallback(async () => {
    try {
      const res = await api.get('/eventos');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEventos(res.data.data);
        if (res.data.data.length > 0) {
          setEventoId((prev) => prev || String(res.data.data[0].id));
        }
      }
    } catch (e) {
      console.error('Error al cargar eventos:', e);
      setError('No se pudieron cargar los eventos');
    }
  }, []);

  const cargarPanel = useCallback(async () => {
    if (!eventoId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/dashboard/panel-vivo?evento_id=${eventoId}`);
      if (res.data?.success) {
        setData(res.data.data);
        setUltimaActualizacion(res.data.data?.ultima_actualizacion || new Date().toISOString());
      } else {
        setError(res.data?.message || 'Error al cargar el panel');
      }
    } catch (e) {
      console.error('Error al cargar panel en vivo:', e);
      setError(e.response?.data?.message || 'Error al cargar el panel en vivo');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    cargarEventos();
  }, []);

  useEffect(() => {
    cargarPanel();
    const t = setInterval(cargarPanel, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [cargarPanel]);

  const formatearHora = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="admin-page panel-en-vivo-page">
      <div className="admin-content">
        <div className="panel-en-vivo-header">
          <h1>Panel en vivo</h1>
          <p>Ingresados, por escanear y rechazados por evento</p>
        </div>

        <div className="panel-en-vivo-filtros">
          <label>Evento:</label>
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="panel-en-vivo-select"
          >
            <option value="">Selecciona un evento</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titulo || `Evento #${ev.id}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-actualizar-panel"
            onClick={cargarPanel}
            disabled={loading || !eventoId}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {error && <div className="panel-en-vivo-error">{error}</div>}

        {loading && !data && <div className="panel-en-vivo-loading">Cargando…</div>}

        {data && !loading && (
          <>
            <div className="panel-en-vivo-titulo-evento">{data.evento_titulo}</div>
            <div className="panel-en-vivo-cards">
              <div className="panel-en-vivo-card card-ingresados">
                <span className="panel-en-vivo-card-label">Ingresados</span>
                <span className="panel-en-vivo-card-value">{data.ingresados}</span>
                <span className="panel-en-vivo-card-sub">entradas ya escaneadas</span>
              </div>
              <div className="panel-en-vivo-card card-por-escanear">
                <span className="panel-en-vivo-card-label">Por escanear</span>
                <span className="panel-en-vivo-card-value">{data.por_escanear}</span>
                <span className="panel-en-vivo-card-sub">confirmadas pendientes de escanear</span>
              </div>
              <div className="panel-en-vivo-card card-rechazados">
                <span className="panel-en-vivo-card-label">Rechazados</span>
                <span className="panel-en-vivo-card-value">{data.rechazados ?? 0}</span>
                <span className="panel-en-vivo-card-sub">intentos inválidos o ya escaneadas</span>
              </div>
            </div>
            <div className="panel-en-vivo-footer">
              <span>Total confirmadas: <strong>{data.total_confirmadas}</strong></span>
              <span className="panel-en-vivo-hora">Última actualización: {formatearHora(ultimaActualizacion)} (se actualiza cada 15 s)</span>
            </div>
          </>
        )}

        {!data && !loading && eventoId && !error && (
          <div className="panel-en-vivo-sin-datos">Sin datos para este evento</div>
        )}
      </div>
    </div>
  );
};

export default PanelEnVivo;
