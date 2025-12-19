import { useEffect, useState } from 'react';
import api from '../../api/axios';
import './AdminLayout.css';
import './Dashboard.css';

const Icon = ({ children }) => (
  <div className="dash-icon">{children}</div>
);

const StatCard = ({ title, value, subtitle, icon, tone = 'default' }) => (
  <div className={`dash-card tone-${tone}`}>
    <div className="dash-card-top">
      <Icon>{icon}</Icon>
      <div className="dash-card-text">
        <span className="dash-card-title">{title}</span>
        <span className="dash-card-sub">{subtitle}</span>
      </div>
    </div>
    <div className="dash-card-value">{value}</div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/dashboard/resumen');
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError(res.data.message || 'No se pudo cargar el panel');
      }
    } catch (err) {
      console.error('Error dashboard:', err);
      setError(err.response?.data?.message || 'Error al cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fmtNumber = (n) =>
    Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number(n || 0));

  const fmtMoney = (n) =>
    Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(Number(n || 0));

  return (
    <div className="admin-page dashboard-page">
      <div className="admin-content">
        <div className="dash-header">
          <div>
            <h1>Panel de Control</h1>
            <p>Vista rápida de la operación.</p>
          </div>
          <button className="dash-refresh" onClick={loadData} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && <div className="dash-error">{error}</div>}
        {loading && <div className="dash-loading">Cargando métricas...</div>}

        {data && !loading && (
          <>
            <div className="dash-grid">
              <StatCard
                title="Clientes"
                value={fmtNumber(data.clientes)}
                subtitle="Registrados"
                tone="blue"
                icon="👥"
              />
              <StatCard
                title="Eventos"
                value={`${fmtNumber(data.eventos)} / ${fmtNumber(data.eventos_habilitados)} activos`}
                subtitle="Total / Habilitados"
                tone="indigo"
                icon="🎫"
              />
              <StatCard
                title="Pagos confirmados"
                value={fmtNumber(data.pagos_confirmados)}
                subtitle={`${fmtNumber(data.entradas_confirmadas)} entradas`}
                tone="green"
                icon="✅"
              />
              <StatCard
                title="Pagos pendientes"
                value={fmtNumber(data.pagos_pendientes)}
                subtitle={`${fmtNumber(data.entradas_pendientes)} entradas`}
                tone="amber"
                icon="⏳"
              />
            </div>

            <div className="dash-grid">
              <StatCard
                title="Ingresos confirmados"
                value={fmtMoney(data.ingresos_confirmados)}
                subtitle="Pagos completados"
                tone="emerald"
                icon="💰"
              />
              <StatCard
                title="Monto pendiente"
                value={fmtMoney(data.monto_pendiente)}
                subtitle="Por cobrar"
                tone="orange"
                icon="🧾"
              />
              <StatCard
                title="Compras totales"
                value={fmtNumber(data.compras)}
                subtitle="Registros"
                tone="slate"
                icon="🛒"
              />
              <StatCard
                title="Última actualización"
                value={new Date(data.ultima_actualizacion).toLocaleTimeString('es-ES')}
                subtitle={new Date(data.ultima_actualizacion).toLocaleDateString('es-ES')}
                tone="gray"
                icon="🕒"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

