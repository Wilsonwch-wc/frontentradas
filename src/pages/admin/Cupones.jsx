import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import Modal from '../../components/Modal';
import './AdminLayout.css';
import './Cupones.css';

const Cupones = () => {
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [cupones, setCupones] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCupon, setEditingCupon] = useState(null);
  const [formData, setFormData] = useState({
    evento_id: '',
    codigo: '',
    porcentaje_descuento: '',
    limite_usos: 1,
    limite_por_cliente: 1,
    fecha_inicio: '',
    fecha_fin: '',
    descripcion: '',
    activo: true
  });
  const [eventoFiltro, setEventoFiltro] = useState('');

  useEffect(() => {
    loadEventos();
    loadCupones();
  }, []);

  useEffect(() => {
    if (eventoFiltro) {
      loadCupones(eventoFiltro);
    } else {
      loadCupones();
    }
  }, [eventoFiltro]);

  const loadEventos = async () => {
    try {
      const response = await api.get('/eventos');
      if (response.data.success) {
        setEventos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    }
  };

  const loadCupones = async (eventoId = null) => {
    setLoading(true);
    try {
      const params = eventoId ? { evento_id: eventoId } : {};
      const response = await api.get('/cupones', { params });
      if (response.data.success) {
        setCupones(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar cupones:', error);
      showAlert('Error al cargar los cupones', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cupon = null) => {
    if (cupon) {
      setEditingCupon(cupon);
      setFormData({
        evento_id: cupon.evento_id,
        codigo: cupon.codigo,
        porcentaje_descuento: cupon.porcentaje_descuento,
        limite_usos: cupon.limite_usos,
        limite_por_cliente: cupon.limite_por_cliente != null ? cupon.limite_por_cliente : 1,
        fecha_inicio: cupon.fecha_inicio ? cupon.fecha_inicio.split('T')[0] : '',
        fecha_fin: cupon.fecha_fin ? cupon.fecha_fin.split('T')[0] : '',
        descripcion: cupon.descripcion || '',
        activo: cupon.activo === 1 || cupon.activo === true
      });
    } else {
      setEditingCupon(null);
      setFormData({
        evento_id: '',
        codigo: '',
        porcentaje_descuento: '',
        limite_usos: 1,
        limite_por_cliente: 1,
        fecha_inicio: '',
        fecha_fin: '',
        descripcion: '',
        activo: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCupon(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const dataToSend = {
        ...formData,
        porcentaje_descuento: parseFloat(formData.porcentaje_descuento),
        limite_usos: parseInt(formData.limite_usos, 10),
        limite_por_cliente: formData.limite_por_cliente === '' || formData.limite_por_cliente == null ? 0 : parseInt(formData.limite_por_cliente, 10),
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null
      };

      if (editingCupon) {
        await api.put(`/cupones/${editingCupon.id}`, dataToSend);
        showAlert('Cupón actualizado exitosamente', { type: 'success' });
      } else {
        await api.post('/cupones', dataToSend);
        showAlert('Cupón creado exitosamente', { type: 'success' });
      }
      
      handleCloseModal();
      loadCupones(eventoFiltro || null);
    } catch (error) {
      const message = error.response?.data?.message || 'Error al guardar el cupón';
      showAlert(message, { type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este cupón?')) {
      return;
    }

    try {
      await api.delete(`/cupones/${id}`);
      showAlert('Cupón eliminado exitosamente', { type: 'success' });
      loadCupones(eventoFiltro || null);
    } catch (error) {
      const message = error.response?.data?.message || 'Error al eliminar el cupón';
      showAlert(message, { type: 'error' });
    }
  };

  const handleVerEstadisticas = async (cupon) => {
    try {
      const response = await api.get(`/cupones/${cupon.id}/estadisticas`);
      if (response.data.success) {
        const stats = response.data.data;
        const mensaje = `
          Cupón: ${cupon.codigo}
          Usos: ${stats.estadisticas.usos_actuales} / ${stats.estadisticas.limite_usos}
          Disponibles: ${stats.estadisticas.usos_disponibles}
          Total compras: ${stats.estadisticas.total_compras}
          Descuento aplicado: $${stats.estadisticas.total_descuento_aplicado.toFixed(2)}
          Total ventas: $${stats.estadisticas.total_ventas.toFixed(2)}
        `;
        alert(mensaje);
      }
    } catch (error) {
      showAlert('Error al obtener estadísticas', { type: 'error' });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="cupones-header">
          <div>
            <h1>Cupones de Descuento</h1>
            <p>Gestiona los cupones de descuento para tus eventos</p>
          </div>
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            + Crear Cupón
          </button>
        </div>

        <div className="cupones-filters">
          <select
            value={eventoFiltro}
            onChange={(e) => setEventoFiltro(e.target.value)}
            className="form-select"
          >
            <option value="">Todos los eventos</option>
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>
                {evento.titulo}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Cargando cupones...</div>
        ) : cupones.length === 0 ? (
          <div className="empty-state">
            <p>No hay cupones creados aún</p>
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              Crear primer cupón
            </button>
          </div>
        ) : (
          <div className="cupones-table-container">
            <table className="cupones-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Evento</th>
                  <th>Descuento</th>
                  <th>Usos</th>
                  <th>Por cliente</th>
                  <th>Estado</th>
                  <th>Válido desde</th>
                  <th>Válido hasta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cupones.map((cupon) => (
                  <tr key={cupon.id}>
                    <td><strong>{cupon.codigo}</strong></td>
                    <td>{cupon.evento_titulo}</td>
                    <td>{cupon.porcentaje_descuento}%</td>
                    <td>
                      {cupon.usos_actuales} / {cupon.limite_usos}
                    </td>
                    <td>
                      {cupon.limite_por_cliente == null || cupon.limite_por_cliente === 0 ? 'Ilimitado' : `${cupon.limite_por_cliente} vez${cupon.limite_por_cliente > 1 ? 'es' : ''}`}
                    </td>
                    <td>
                      <span className={`badge ${cupon.activo ? 'badge-success' : 'badge-danger'}`}>
                        {cupon.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {cupon.fecha_inicio
                        ? new Date(cupon.fecha_inicio).toLocaleDateString('es-ES')
                        : 'Sin límite'}
                    </td>
                    <td>
                      {cupon.fecha_fin
                        ? new Date(cupon.fecha_fin).toLocaleDateString('es-ES')
                        : 'Sin límite'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => handleVerEstadisticas(cupon)}
                          title="Ver estadísticas"
                        >
                          📊
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleOpenModal(cupon)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDelete(cupon.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingCupon ? 'Editar Cupón' : 'Crear Nuevo Cupón'}
        >
          <form onSubmit={handleSubmit} className="cupon-form">
            <div className="form-group">
              <label>Evento *</label>
              <select
                value={formData.evento_id}
                onChange={(e) => setFormData({ ...formData, evento_id: e.target.value })}
                required
                disabled={!!editingCupon}
                className="form-select"
              >
                <option value="">Seleccionar evento</option>
                {eventos.map((evento) => (
                  <option key={evento.id} value={evento.id}>
                    {evento.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Código del Cupón *</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                required
                placeholder="Ej: DESCUENTO10"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Porcentaje de Descuento *</label>
              <input
                type="number"
                value={formData.porcentaje_descuento}
                onChange={(e) => setFormData({ ...formData, porcentaje_descuento: e.target.value })}
                required
                min="0"
                max="100"
                step="0.01"
                placeholder="Ej: 10"
                className="form-input"
              />
              <small>Ingresa un valor entre 0 y 100</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Límite de Usos (total) *</label>
                <input
                  type="number"
                  value={formData.limite_usos}
                  onChange={(e) => setFormData({ ...formData, limite_usos: e.target.value })}
                  required
                  min="1"
                  placeholder="Ej: 100"
                  className="form-input"
                />
                <small>Veces que se puede usar el cupón en total</small>
              </div>
              <div className="form-group">
                <label>Usos por cliente</label>
                <select
                  value={formData.limite_por_cliente}
                  onChange={(e) => setFormData({ ...formData, limite_por_cliente: e.target.value })}
                  className="form-select"
                >
                  <option value="1">1 vez por cliente</option>
                  <option value="2">2 veces por cliente</option>
                  <option value="3">3 veces por cliente</option>
                  <option value="5">5 veces por cliente</option>
                  <option value="10">10 veces por cliente</option>
                  <option value="0">Ilimitado (solo límite total)</option>
                </select>
                <small>Cuántas veces puede usar el mismo cliente este cupón</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Fecha de Inicio</label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  className="form-input"
                />
                <small>Dejar vacío para activar inmediatamente</small>
              </div>

              <div className="form-group">
                <label>Fecha de Fin</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  className="form-input"
                />
                <small>Dejar vacío para sin límite</small>
              </div>
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción opcional del cupón"
                className="form-input"
                rows="3"
              />
            </div>

            {editingCupon && (
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  />
                  {' '}Cupón activo
                </label>
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={handleCloseModal} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {editingCupon ? 'Actualizar' : 'Crear'} Cupón
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default Cupones;
