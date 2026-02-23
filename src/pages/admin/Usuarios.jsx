import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './Usuarios.css';

const Usuarios = () => {
  const { showAlert, showConfirm } = useAlert();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rolesGestion, setRolesGestion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ nombre: '', descripcion: '', activo: true });
  const [roleError, setRoleError] = useState('');
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    nombre_completo: '',
    telefono: '',
    correo: '',
    password: '',
    id_rol: '',
    activo: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.get('/usuarios');
      if (response.data.success) {
        setUsuarios(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setError('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const cargarRoles = async () => {
    try {
      const response = await api.get('/usuarios/roles');
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar roles:', error);
    }
  };

  const cargarRolesGestion = async () => {
    try {
      const response = await api.get('/usuarios/roles?todos=1');
      if (response.data.success) {
        setRolesGestion(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar roles (gestión):', error);
      showAlert('Error al cargar roles', { type: 'error' });
    }
  };

  const abrirModalRoles = async () => {
    setRoleError('');
    setEditingRole(null);
    setRoleForm({ nombre: '', descripcion: '', activo: true });
    setShowRolesModal(true);
    await cargarRolesGestion();
  };

  const cerrarModalRoles = () => {
    setShowRolesModal(false);
    setEditingRole(null);
    setRoleForm({ nombre: '', descripcion: '', activo: true });
    setRoleError('');
  };

  const handleRoleInput = (e) => {
    const { name, value, type, checked } = e.target;
    setRoleForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setRoleError('');
  };

  const guardarRol = async (e) => {
    e.preventDefault();
    setRoleError('');
    try {
      if (!roleForm.nombre || !String(roleForm.nombre).trim()) {
        setRoleError('El nombre del rol es requerido');
        return;
      }
      if (editingRole) {
        const res = await api.put(`/usuarios/roles/${editingRole.id}`, roleForm);
        if (res.data.success) {
          await Promise.all([cargarRolesGestion(), cargarRoles(), cargarUsuarios()]);
          setEditingRole(null);
          setRoleForm({ nombre: '', descripcion: '', activo: true });
        }
      } else {
        const res = await api.post('/usuarios/roles', roleForm);
        if (res.data.success) {
          await Promise.all([cargarRolesGestion(), cargarRoles()]);
          setRoleForm({ nombre: '', descripcion: '', activo: true });
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar el rol';
      setRoleError(msg);
    }
  };

  const editarRol = (rol) => {
    setEditingRole(rol);
    setRoleForm({
      nombre: rol.nombre || '',
      descripcion: rol.descripcion || '',
      activo: !!rol.activo
    });
    setRoleError('');
  };

  const toggleRolActivo = async (rol) => {
    try {
      const res = await api.put(`/usuarios/roles/${rol.id}`, { activo: !rol.activo });
      if (res.data.success) {
        await Promise.all([cargarRolesGestion(), cargarRoles(), cargarUsuarios()]);
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Error al cambiar el estado del rol', { type: 'error' });
    }
  };

  const eliminarRol = async (rol) => {
    const confirmado = await showConfirm(`¿Eliminar el rol "${rol.nombre}"?`, {
      type: 'warning',
      title: 'Eliminar Rol'
    });
    if (!confirmado) return;
    try {
      const res = await api.delete(`/usuarios/roles/${rol.id}`);
      if (res.data.success) {
        await Promise.all([cargarRolesGestion(), cargarRoles(), cargarUsuarios()]);
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Error al eliminar el rol', { type: 'error' });
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        // Actualizar usuario
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        const response = await api.put(`/usuarios/${editingUser.id}`, updateData);
        if (response.data.success) {
          cargarUsuarios();
          cerrarModal();
        }
      } else {
        // Crear usuario
        if (!formData.password) {
          setError('La contraseña es requerida');
          return;
        }
        const response = await api.post('/usuarios', formData);
        if (response.data.success) {
          cargarUsuarios();
          cerrarModal();
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al guardar el usuario';
      setError(errorMessage);
    }
  };

  const handleEdit = (usuario) => {
    setEditingUser(usuario);
    setFormData({
      nombre_usuario: usuario.nombre_usuario,
      nombre_completo: usuario.nombre_completo,
      telefono: usuario.telefono || '',
      correo: usuario.correo,
      password: '',
      id_rol: usuario.id_rol,
      activo: usuario.activo
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmado = await showConfirm('¿Estás seguro de que deseas eliminar este usuario?', { 
      type: 'warning',
      title: 'Eliminar Usuario'
    });
    if (!confirmado) {
      return;
    }

    try {
      const response = await api.delete(`/usuarios/${id}`);
      if (response.data.success) {
        cargarUsuarios();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al eliminar el usuario';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  const abrirModalNuevo = () => {
    setEditingUser(null);
    setFormData({
      nombre_usuario: '',
      nombre_completo: '',
      telefono: '',
      correo: '',
      password: '',
      id_rol: '',
      activo: true
    });
    setError('');
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setError('');
  };

  const toggleActivo = async (usuario) => {
    try {
      const response = await api.put(`/usuarios/${usuario.id}`, {
        activo: !usuario.activo
      });
      if (response.data.success) {
        cargarUsuarios();
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  };

  const handleBorrarTodosLosDatos = async () => {
    const confirmado = await showConfirm(
      '⚠️ ADVERTENCIA: Esta acción eliminará TODOS los datos de la base de datos excepto:\n\n' +
      '• Usuarios y roles\n' +
      '• Datos de contacto (contacto_info)\n\n' +
      'Se eliminará:\n' +
      '• Todos los eventos, compras, entradas y clientes\n' +
      '• Asientos, mesas, áreas, tipos de precio\n' +
      '• Pagos, escaneos y cupones\n\n' +
      '¿Estás completamente seguro de que deseas continuar?',
      {
        type: 'warning',
        title: 'Borrar Todos los Datos',
        confirmText: 'Sí, borrar todo',
        cancelText: 'Cancelar'
      }
    );

    if (!confirmado) {
      return;
    }

    try {
      const response = await api.delete('/usuarios/datos/todos');
      if (response.data.success) {
        showAlert(response.data.message, { type: 'success' });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al borrar los datos';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="usuarios-header">
          <div>
            <h1>Gestión de Usuarios</h1>
            <p>Administra los usuarios del sistema</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn-danger"
              onClick={handleBorrarTodosLosDatos}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Eliminar todos los datos (se conservan usuarios, roles y datos de contacto)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Borrar Datos
            </button>
            <button className="btn-secondary" onClick={abrirModalRoles} title="Crear / editar roles">
              ⚙️ Roles
            </button>
            <button className="btn-primary" onClick={abrirModalNuevo}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nuevo Usuario
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Cargando usuarios...</div>
        ) : (
          <div className="usuarios-table-container">
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Nombre Completo</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">No hay usuarios registrados</td>
                  </tr>
                ) : (
                  usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.id}</td>
                      <td>{usuario.nombre_usuario}</td>
                      <td>{usuario.nombre_completo}</td>
                      <td>{usuario.correo}</td>
                      <td>{usuario.telefono || '-'}</td>
                      <td>
                        <span className={`badge badge-${usuario.rol_nombre}`}>
                          {usuario.rol_nombre}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`toggle-activo ${usuario.activo ? 'activo' : 'inactivo'}`}
                          onClick={() => toggleActivo(usuario)}
                        >
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <div className="acciones">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(usuario)}
                            title="Editar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(usuario.id)}
                            title="Eliminar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal para crear/editar usuario */}
        {showModal && (
          <div className="modal-overlay" onClick={cerrarModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                <button className="modal-close" onClick={cerrarModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre de Usuario *</label>
                    <input
                      type="text"
                      name="nombre_usuario"
                      value={formData.nombre_usuario}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nombre Completo *</label>
                    <input
                      type="text"
                      name="nombre_completo"
                      value={formData.nombre_completo}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Correo Electrónico *</label>
                    <input
                      type="email"
                      name="correo"
                      value={formData.correo}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contraseña {!editingUser && '*'}</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={!editingUser}
                      placeholder={editingUser ? 'Dejar vacío para no cambiar' : ''}
                    />
                  </div>

                  <div className="form-group">
                    <label>Rol *</label>
                    <select
                      name="id_rol"
                      value={formData.id_rol}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Seleccionar rol</option>
                      {roles.map((rol) => (
                        <option key={rol.id} value={rol.id}>
                          {rol.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                    />
                    Usuario activo
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={cerrarModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingUser ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal para gestionar roles */}
        {showRolesModal && (
          <div className="modal-overlay" onClick={cerrarModalRoles}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
              <div className="modal-header">
                <h2>Gestionar Roles</h2>
                <button className="modal-close" onClick={cerrarModalRoles}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <form onSubmit={guardarRol} className="modal-form">
                {roleError && <div className="error-message">{roleError}</div>}

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Nombre del rol *</label>
                    <input name="nombre" value={roleForm.nombre} onChange={handleRoleInput} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Descripción</label>
                    <input name="descripcion" value={roleForm.descripcion} onChange={handleRoleInput} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" name="activo" checked={roleForm.activo} onChange={handleRoleInput} />
                    Rol activo
                  </label>
                </div>

                <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingRole && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setEditingRole(null); setRoleForm({ nombre: '', descripcion: '', activo: true }); setRoleError(''); }}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                  <button type="submit" className="btn-primary">
                    {editingRole ? 'Actualizar rol' : 'Crear rol'}
                  </button>
                </div>
              </form>

              <div className="usuarios-table-container" style={{ marginTop: 14 }}>
                <table className="usuarios-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Rol</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesGestion.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">No hay roles</td>
                      </tr>
                    ) : (
                      rolesGestion.map((rol) => (
                        <tr key={rol.id}>
                          <td>{rol.id}</td>
                          <td><strong>{rol.nombre}</strong></td>
                          <td>{rol.descripcion || '-'}</td>
                          <td>
                            <span className={`badge ${rol.activo ? 'badge-active' : 'badge-inactive'}`}>
                              {rol.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="acciones">
                              <button className="btn-edit" onClick={() => editarRol(rol)} title="Editar">
                                ✎
                              </button>
                              <button className="btn-edit" onClick={() => toggleRolActivo(rol)} title={rol.activo ? 'Desactivar' : 'Activar'}>
                                {rol.activo ? '⏸' : '▶'}
                              </button>
                              <button className="btn-delete" onClick={() => eliminarRol(rol)} title="Eliminar">
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Usuarios;
