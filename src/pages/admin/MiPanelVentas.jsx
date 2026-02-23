import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import './MiPanelVentas.css';

const StatCard = ({ title, value, subtitle, tone = 'default' }) => (
  <div className={`mipv-card tone-${tone}`}>
    <div className="mipv-card-title">{title}</div>
    <div className="mipv-card-value">{value}</div>
    {subtitle ? <div className="mipv-card-sub">{subtitle}</div> : null}
  </div>
);

const MiPanelVentas = () => {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fmtNumber = (n) =>
    Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(n || 0));

  const fmtMoney = (n) =>
    Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(Number(n || 0));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/compras/mis-ventas/resumen');
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError(res.data.message || 'No se pudo cargar el panel');
      }
    } catch (e) {
      console.error('Error mi panel ventas:', e);
      const msg = e.response?.data?.message || 'Error al cargar el panel';
      setError(msg);
      showAlert(msg, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = data?.resumen || {};
  const porEvento = Array.isArray(data?.por_evento) ? data.por_evento : [];

  return (
    <div className="admin-page mipv-page">
      <div className="admin-content">
        <div className="mipv-header">
          <div>
            <h1>Mi Panel</h1>
            <p>Resumen de tus ventas e ingresos.</p>
            {user?.nombre_usuario ? (
              <p className="mipv-user">
                Usuario: <strong>{user.nombre_usuario}</strong>
              </p>
            ) : null}
          </div>
          <button className="mipv-refresh" onClick={load} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error ? <div className="mipv-error">{error}</div> : null}

        {loading && !data ? (
          <div className="loading">Cargando...</div>
        ) : (
          <>
            <div className="mipv-grid">
              <StatCard
                title="Ingresos confirmados"
                value={fmtMoney(r.ingresos_confirmados)}
                subtitle="Pagos realizados"
                tone="success"
              />
              <StatCard
                title="Ventas confirmadas"
                value={fmtNumber(r.ventas_confirmadas)}
                subtitle="Compras pagadas"
                tone="success"
              />
              <StatCard
                title="Entradas confirmadas"
                value={fmtNumber(r.entradas_confirmadas)}
                subtitle="Cantidad total"
                tone="success"
              />
              <StatCard
                title="Pendientes"
                value={`${fmtNumber(r.ventas_pendientes)} (${fmtMoney(r.monto_pendiente)})`}
                subtitle="Pagos por confirmar"
                tone="warning"
              />
              <StatCard
                title="Canceladas"
                value={fmtNumber(r.ventas_canceladas)}
                subtitle="Compras canceladas"
                tone="danger"
              />
              <StatCard
                title="Ventas totales"
                value={fmtNumber(r.ventas_totales)}
                subtitle="Todas las compras"
                tone="default"
              />
            </div>

            <div className="mipv-section">
              <div className="mipv-section-title">Por evento</div>
              <div className="usuarios-table-container">
                <table className="usuarios-table">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>Confirmadas</th>
                      <th>Ingresos</th>
                      <th>Pendientes</th>
                      <th>Monto pendiente</th>
                      <th>Canceladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porEvento.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">
                          Aún no tienes ventas registradas.
                        </td>
                      </tr>
                    ) : (
                      porEvento.map((ev) => (
                        <tr key={ev.evento_id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{ev.evento_titulo}</strong>
                              {ev.evento_fecha ? (
                                <small style={{ color: '#6b7280' }}>
                                  {new Date(ev.evento_fecha).toLocaleString('es-ES')}
                                </small>
                              ) : null}
                            </div>
                          </td>
                          <td>{fmtNumber(ev.ventas_confirmadas)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtMoney(ev.ingresos_confirmados)}</td>
                          <td>{fmtNumber(ev.ventas_pendientes)}</td>
                          <td>{fmtMoney(ev.monto_pendiente)}</td>
                          <td>{fmtNumber(ev.ventas_canceladas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {r.ultima_actualizacion ? (
                <div className="mipv-updated">
                  Última actualización: {new Date(r.ultima_actualizacion).toLocaleString('es-ES')}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MiPanelVentas;

