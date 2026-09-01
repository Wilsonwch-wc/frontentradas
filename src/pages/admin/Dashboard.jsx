import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
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
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const { isVendedor, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventoSeleccionado, setEventoSeleccionado] = useState('');
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

  // Modal de pagos pendientes
  const [showPendientesModal, setShowPendientesModal] = useState(false);
  const [comprasPendientes, setComprasPendientes] = useState([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  useEffect(() => {
    if (isVendedor && isVendedor()) {
      navigate('/admin/compras', { replace: true });
      return;
    }
    const rol = (user?.rol || '').toLowerCase();
    if (rol === 'seguridad') {
      navigate('/admin/busqueda-entrada', { replace: true });
    }
  }, [isVendedor, user?.rol, navigate]);

  const loadData = async (eventoId) => {
    const id = (eventoId !== undefined && eventoId !== null && eventoId !== '') ? eventoId : eventoSeleccionado;
    const idParaUrl = (id !== undefined && id !== null && id !== '') ? id : null;
    setLoading(true);
    setError('');
    try {
      const url = idParaUrl ? `/dashboard/resumen?evento_id=${idParaUrl}` : '/dashboard/resumen';
      const res = await api.get(url);
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

  // Cargar compras pendientes
  const cargarComprasPendientes = async () => {
    setLoadingPendientes(true);
    try {
      const eventoParam = eventoSeleccionado ? `&evento_id=${eventoSeleccionado}` : '';
      const res = await api.get(`/compras?estado=PAGO_PENDIENTE${eventoParam}`);
      if (res.data.success) {
        setComprasPendientes(res.data.data || []);
      }
    } catch (err) {
      console.error('Error al cargar compras pendientes:', err);
      showAlert('Error al cargar las compras pendientes', { type: 'error' });
    } finally {
      setLoadingPendientes(false);
    }
  };

  const handleAbrirModalPendientes = () => {
    if (data?.pagos_pendientes > 0) {
      setShowPendientesModal(true);
      cargarComprasPendientes();
    }
  };

  const handleVerDetalleCompra = (compraId) => {
    setShowPendientesModal(false);
    navigate(`/admin/compras?buscar=${compraId}`);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCambiarEvento = (e) => {
    const value = e.target.value;
    setEventoSeleccionado(value);
    loadData(value);
  };

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
            {data?.lista_eventos?.length > 0 && (
              <div className="dash-selector-evento">
                <label htmlFor="dash-evento-select">Ver datos del evento: </label>
                <select
                  id="dash-evento-select"
                  value={eventoSeleccionado}
                  onChange={handleCambiarEvento}
                  className="dash-evento-select"
                >
                  <option value="">Evento activo (próximo)</option>
                  {data.lista_eventos.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.titulo}
                      {ev.estado ? ` (${ev.estado})` : ''}
                      {ev.hora_inicio ? ` — ${new Date(ev.hora_inicio).toLocaleDateString('es-ES')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {data?.evento_activo_nombres?.length > 0 && (
              <p className="dash-evento-activo">
                Datos del evento: <strong>{data.evento_activo_nombres.join(', ')}</strong>
              </p>
            )}
            {!eventoSeleccionado && data?.eventos_habilitados === 0 && (
              <p className="dash-evento-activo dash-sin-evento">No hay evento activo (próximo); las cifras de ventas están en cero.</p>
            )}
          </div>
          <button className="dash-refresh" onClick={() => loadData()} disabled={loading}>
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
                title="Ventas Realizadas"
                value={fmtNumber(data.pagos_confirmados)}
                subtitle={`${fmtNumber(data.entradas_confirmadas)} entradas vendidas`}
                tone="green"
                icon="✅"
              />
              <StatCard
                title="Entradas Ingresadas"
                value={fmtNumber(data.entradas_usadas || 0)}
                subtitle="Escaneadas en puerta"
                tone="purple"
                icon="🎟️"
              />
            </div>

            <div className="dash-grid">
              <StatCard
                title="Total Recaudado"
                value={fmtMoney(data.ingresos_confirmados)}
                subtitle="Ventas confirmadas"
                tone="emerald"
                icon="💰"
              />
              <StatCard
                title="Compras Totales"
                value={fmtNumber(data.compras)}
                subtitle="Transacciones exitosas"
                tone="slate"
                icon="🛒"
              />
              <StatCard
                title="Promedio por Venta"
                value={data.compras > 0 ? fmtMoney(data.ingresos_confirmados / data.compras) : 'Bs. 0.00'}
                subtitle="Ticket promedio"
                tone="blue"
                icon="📈"
              />
              <StatCard
                title="Última actualización"
                value={new Date(data.ultima_actualizacion).toLocaleTimeString('es-ES')}
                subtitle={new Date(data.ultima_actualizacion).toLocaleDateString('es-ES')}
                tone="gray"
                icon="🕒"
              />
            </div>

            {/* Gráficos Ejecutivos de Ventas */}
            {data && (
              <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Resumen de Recaudación */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b', fontSize: '1.15rem' }}>💰 Rendimiento de Ventas</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Total Recaudado:</span>
                      <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>{fmtMoney(data.ingresos_confirmados)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Entradas Vendidas:</span>
                      <strong style={{ fontSize: '1.15rem', color: '#2563eb' }}>{fmtNumber(data.entradas_confirmadas)} tickets</strong>
                    </div>
                  </div>
                </div>

                {/* Control de Asistencia */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b', fontSize: '1.15rem' }}>🎟️ Control de Asistencia y Aforo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Tickets Emitidos:</span>
                      <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{fmtNumber(data.entradas_confirmadas)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Ingresados al Evento:</span>
                      <strong style={{ fontSize: '1.15rem', color: '#7c3aed' }}>{fmtNumber(data.entradas_usadas || 0)}</strong>
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
          wide
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

        {/* Modal de Pagos Pendientes */}
        <Modal
          isOpen={showPendientesModal}
          onClose={() => setShowPendientesModal(false)}
          title="Compras con Pago Pendiente"
          wide
        >
          <div style={{ padding: '20px' }}>
            {loadingPendientes ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Cargando compras pendientes...</div>
            ) : (
              <>
                <p style={{ marginBottom: '20px', color: '#667085' }}>
                  {comprasPendientes.length} compra(s) pendiente(s) de verificación
                  {eventoSeleccionado && data?.evento_activo_nombres?.length > 0 && (
                    <span> para el evento: <strong>{data.evento_activo_nombres.join(', ')}</strong></span>
                  )}
                </p>

                {comprasPendientes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#98a2b3' }}>
                    No hay compras pendientes de verificación
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Código</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Cliente</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Evento</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Entradas</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Total</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Fecha</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comprasPendientes.map((compra) => (
                          <tr key={compra.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '12px' }}>
                              <code style={{ 
                                background: '#f4f5f7', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                fontSize: '0.85rem'
                              }}>
                                {compra.codigo_unico}
                              </code>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div>
                                <strong>{compra.cliente_nombre}</strong>
                                {compra.cliente_telefono && (
                                  <div style={{ fontSize: '0.85rem', color: '#667085' }}>
                                    {compra.cliente_telefono}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                              {compra.evento_titulo || '-'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                              {compra.cantidad || compra.total_entradas || '-'}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: '#b54708' }}>
                              Bs. {parseFloat(compra.total || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '12px', fontSize: '0.85rem', color: '#667085' }}>
                              {formatearFecha(compra.fecha_compra)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleVerDetalleCompra(compra.codigo_unico)}
                                style={{
                                  padding: '8px 16px',
                                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                👁️ Ver / Verificar
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
        </Modal>
      </div>
    </div>
  );
};

export default Dashboard;

