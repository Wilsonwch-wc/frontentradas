import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import Modal from '../../components/Modal';
import './AdminLayout.css';
import './Dashboard.css';

const Icon = ({ children }) => (
  <div className="dash-icon">{children}</div>
);

const StatCard = ({ title, value, subtitle, icon, tone = 'default', onClick }) => (
  <div 
    className={`dash-card tone-${tone}`}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
  >
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
  const { showAlert, showConfirm } = useAlert();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showClientesModal, setShowClientesModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteFormData, setClienteFormData] = useState({
    nombre: '',
    apellido: '',
    nombre_completo: '',
    correo: '',
    telefono: '',
    activo: true
  });

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

  const cargarClientes = async () => {
    setLoadingClientes(true);
    try {
      const res = await api.get('/clientes/admin');
      if (res.data.success) {
        setClientes(res.data.data);
      }
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      showAlert('Error al cargar los clientes', { type: 'error' });
    } finally {
      setLoadingClientes(false);
    }
  };

  const handleAbrirModalClientes = () => {
    setShowClientesModal(true);
    cargarClientes();
  };

  const handleCerrarModalClientes = () => {
    setShowClientesModal(false);
    setEditingCliente(null);
    setClienteFormData({
      nombre: '',
      apellido: '',
      nombre_completo: '',
      correo: '',
      telefono: '',
      activo: true
    });
  };

  const handleEditCliente = (cliente) => {
    setEditingCliente(cliente);
    setClienteFormData({
      nombre: cliente.nombre || '',
      apellido: cliente.apellido || '',
      nombre_completo: cliente.nombre_completo || '',
      correo: cliente.correo || '',
      telefono: cliente.telefono || '',
      activo: cliente.activo !== undefined ? cliente.activo : true
    });
  };

  const handleSaveCliente = async () => {
    try {
      if (editingCliente) {
        const res = await api.put(`/clientes/admin/${editingCliente.id}`, clienteFormData);
        if (res.data.success) {
          showAlert('Cliente actualizado exitosamente', { type: 'success' });
          cargarClientes();
          handleCerrarModalClientes();
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al guardar el cliente';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  const handleDeleteCliente = async (id) => {
    const confirmado = await showConfirm('¿Estás seguro de que deseas eliminar este cliente? Esto también eliminará todas sus compras.', {
      type: 'warning',
      title: 'Eliminar Cliente'
    });
    if (!confirmado) return;

    try {
      const res = await api.delete(`/clientes/admin/${id}`);
      if (res.data.success) {
        showAlert('Cliente eliminado exitosamente', { type: 'success' });
        cargarClientes();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al eliminar el cliente';
      showAlert(errorMessage, { type: 'error' });
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
                onClick={handleAbrirModalClientes}
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

            {/* Gráficos */}
            {data && (
              <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Gráfico de Ingresos vs Pendientes */}
                <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '1.2rem' }}>Ingresos y Pendientes</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '200px', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        width: '100%', 
                        background: 'linear-gradient(to top, #28a745, #20c997)', 
                        borderRadius: '8px 8px 0 0',
                        height: `${Math.max(10, (data.ingresos_confirmados / (data.ingresos_confirmados + data.monto_pendiente || 1)) * 180)}px`,
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '10px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {fmtMoney(data.ingresos_confirmados).replace(/\s/g, '')}
                      </div>
                      <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#28a745' }}>Confirmados</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        width: '100%', 
                        background: 'linear-gradient(to top, #ffc107, #fd7e14)', 
                        borderRadius: '8px 8px 0 0',
                        height: `${Math.max(10, (data.monto_pendiente / (data.ingresos_confirmados + data.monto_pendiente || 1)) * 180)}px`,
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '10px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {fmtMoney(data.monto_pendiente).replace(/\s/g, '')}
                      </div>
                      <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#ffc107' }}>Pendientes</div>
                    </div>
                  </div>
                </div>

                {/* Gráfico de Compras por Estado */}
                <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '1.2rem' }}>Estado de Compras</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '200px', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        width: '100%', 
                        background: 'linear-gradient(to top, #28a745, #20c997)', 
                        borderRadius: '8px 8px 0 0',
                        height: `${Math.max(10, (data.pagos_confirmados / (data.compras || 1)) * 180)}px`,
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '10px',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.2rem'
                      }}>
                        {data.pagos_confirmados}
                      </div>
                      <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#28a745', textAlign: 'center', fontSize: '0.9rem' }}>Confirmados</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        width: '100%', 
                        background: 'linear-gradient(to top, #ffc107, #fd7e14)', 
                        borderRadius: '8px 8px 0 0',
                        height: `${Math.max(10, (data.pagos_pendientes / (data.compras || 1)) * 180)}px`,
                        minHeight: '20px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '10px',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.2rem'
                      }}>
                        {data.pagos_pendientes}
                      </div>
                      <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#ffc107', textAlign: 'center', fontSize: '0.9rem' }}>Pendientes</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de Clientes */}
        <Modal
          isOpen={showClientesModal}
          onClose={handleCerrarModalClientes}
          title="Gestión de Clientes"
        >
          <div style={{ padding: '20px' }}>
            {loadingClientes ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Cargando clientes...</div>
            ) : (
              <>
                {editingCliente ? (
                  <div style={{ marginBottom: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>Editar Cliente</h3>
                    <div style={{ display: 'grid', gap: '15px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre</label>
                        <input
                          type="text"
                          value={clienteFormData.nombre}
                          onChange={(e) => setClienteFormData({ ...clienteFormData, nombre: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Apellido</label>
                        <input
                          type="text"
                          value={clienteFormData.apellido}
                          onChange={(e) => setClienteFormData({ ...clienteFormData, apellido: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre Completo</label>
                        <input
                          type="text"
                          value={clienteFormData.nombre_completo}
                          onChange={(e) => setClienteFormData({ ...clienteFormData, nombre_completo: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Correo</label>
                        <input
                          type="email"
                          value={clienteFormData.correo}
                          onChange={(e) => setClienteFormData({ ...clienteFormData, correo: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono</label>
                        <input
                          type="text"
                          value={clienteFormData.telefono}
                          onChange={(e) => setClienteFormData({ ...clienteFormData, telefono: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={clienteFormData.activo}
                            onChange={(e) => setClienteFormData({ ...clienteFormData, activo: e.target.checked })}
                          />
                          <span style={{ fontWeight: 'bold' }}>Activo</span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleSaveCliente}
                          style={{
                            padding: '10px 20px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setEditingCliente(null);
                            setClienteFormData({
                              nombre: '',
                              apellido: '',
                              nombre_completo: '',
                              correo: '',
                              telefono: '',
                              activo: true
                            });
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Nombre</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Correo</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Teléfono</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Provider</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Estado</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                            No hay clientes registrados
                          </td>
                        </tr>
                      ) : (
                        clientes.map((cliente) => (
                          <tr key={cliente.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '12px' }}>{cliente.id}</td>
                            <td style={{ padding: '12px' }}>
                              {cliente.nombre_completo || `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'N/A'}
                            </td>
                            <td style={{ padding: '12px' }}>{cliente.correo}</td>
                            <td style={{ padding: '12px' }}>{cliente.telefono || 'N/A'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: cliente.provider === 'google' ? '#4285f4' : '#6c757d',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {cliente.provider?.toUpperCase() || 'LOCAL'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: cliente.activo ? '#28a745' : '#dc3545',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {cliente.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleEditCliente(cliente)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteCliente(cliente.id)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Dashboard;

