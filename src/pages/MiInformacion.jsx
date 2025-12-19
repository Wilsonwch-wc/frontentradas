import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './MiInformacion.css';

const MiInformacion = () => {
  const { user, isAuthenticated, logout, login } = useAuth();
  const navigate = useNavigate();
  const [clienteInfo, setClienteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [editandoPassword, setEditandoPassword] = useState(false);
  const [formData, setFormData] = useState({
    telefono: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Si el usuario tiene rol, es admin, no cliente
    if (user?.rol) {
      navigate('/');
      return;
    }

    cargarInformacion();
  }, [user, isAuthenticated, navigate]);

  const cargarInformacion = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clientes/verify');
      
      if (response.data.success) {
        setClienteInfo(response.data.data.user);
        setFormData({
          telefono: response.data.data.user.telefono || '',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error al cargar información:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleActualizarTelefono = async () => {
    if (!formData.telefono.trim()) {
      setError('El teléfono no puede estar vacío');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await api.put('/clientes/actualizar', {
        telefono: formData.telefono.trim()
      });

      if (response.data.success) {
        setClienteInfo(response.data.data.user);
        setEditandoTelefono(false);
        setSuccess('Teléfono actualizado exitosamente');
        // Actualizar el usuario en el contexto
        login(response.data.data.user, localStorage.getItem('token'));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al actualizar el teléfono');
    } finally {
      setSaving(false);
    }
  };

  const handleActualizarPassword = async () => {
    if (!formData.password) {
      setError('La contraseña es requerida');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await api.put('/clientes/actualizar', {
        password: formData.password
      });

      if (response.data.success) {
        setEditandoPassword(false);
        setFormData({
          ...formData,
          password: '',
          confirmPassword: ''
        });
        setSuccess('Contraseña actualizada exitosamente');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const cancelarEdicion = () => {
    setEditandoTelefono(false);
    setEditandoPassword(false);
    setError('');
    setSuccess('');
    // Restaurar valores originales
    if (clienteInfo) {
      setFormData({
        telefono: clienteInfo.telefono || '',
        password: '',
        confirmPassword: ''
      });
    }
  };

  if (loading) {
    return (
      <div className="mi-informacion-page">
        <div className="container">
          <div className="loading">Cargando información...</div>
        </div>
      </div>
    );
  }

  if (!clienteInfo) {
    return (
      <div className="mi-informacion-page">
        <div className="container">
          <div className="error-message">
            <p>No se pudo cargar la información del usuario</p>
            <button onClick={() => navigate('/')} className="btn-volver">
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mi-informacion-page">
      <div className="container">
        <div className="mi-informacion-header">
          <h1>Mi Información</h1>
          <p>Gestiona tu información personal</p>
        </div>

        <div className="mi-informacion-content">
          <div className="info-card">
            <div className="info-card-header">
              <h2>Información Personal</h2>
            </div>
            <div className="info-card-body">
              {clienteInfo.foto_perfil && (
                <div className="info-avatar">
                  <img 
                    src={clienteInfo.foto_perfil} 
                    alt={clienteInfo.nombre_completo || 'Usuario'}
                    className="avatar-image"
                  />
                </div>
              )}

              <div className="info-grid">
                <div className="info-item">
                  <label className="info-label">Nombre Completo</label>
                  <p className="info-value">
                    {clienteInfo.nombre_completo || 'No especificado'}
                  </p>
                </div>

                <div className="info-item">
                  <label className="info-label">Nombre</label>
                  <p className="info-value">
                    {clienteInfo.nombre || 'No especificado'}
                  </p>
                </div>

                <div className="info-item">
                  <label className="info-label">Apellido</label>
                  <p className="info-value">
                    {clienteInfo.apellido || 'No especificado'}
                  </p>
                </div>

                <div className="info-item">
                  <label className="info-label">Correo Electrónico</label>
                  <p className="info-value">{clienteInfo.correo}</p>
                </div>

                <div className="info-item">
                  <label className="info-label">Teléfono</label>
                  {editandoTelefono ? (
                    <div className="edit-form">
                      <input
                        type="tel"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        placeholder="Ingresa tu teléfono"
                        className="edit-input"
                        disabled={saving}
                      />
                      <div className="edit-actions">
                        <button
                          onClick={handleActualizarTelefono}
                          className="btn-save"
                          disabled={saving}
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={cancelarEdicion}
                          className="btn-cancel"
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value-with-action">
                      <p className="info-value">
                        {clienteInfo.telefono || 'No especificado'}
                      </p>
                      <button
                        onClick={() => {
                          setEditandoTelefono(true);
                          setEditandoPassword(false);
                          setError('');
                          setSuccess('');
                        }}
                        className="btn-edit"
                      >
                        {clienteInfo.telefono ? 'Editar' : 'Agregar'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="info-item">
                  <label className="info-label">Método de Registro</label>
                  <p className="info-value">
                    {clienteInfo.provider === 'google' ? (
                      <span className="provider-badge google">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google
                      </span>
                    ) : (
                      <span className="provider-badge local">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="20" y1="8" x2="20" y2="14"></line>
                          <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        Registro Local
                      </span>
                    )}
                  </p>
                </div>

                <div className="info-item">
                  <label className="info-label">Estado de la Cuenta</label>
                  <p className="info-value">
                    <span className={`status-badge ${clienteInfo.activo ? 'active' : 'inactive'}`}>
                      {clienteInfo.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {clienteInfo.provider === 'local' && (
            <div className="info-card">
              <div className="info-card-header">
                <h2>Seguridad</h2>
              </div>
              <div className="info-card-body">
                <div className="info-item">
                  <label className="info-label">Contraseña</label>
                  {editandoPassword ? (
                    <div className="edit-form">
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Nueva contraseña"
                        className="edit-input"
                        disabled={saving}
                      />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirmar contraseña"
                        className="edit-input"
                        disabled={saving}
                        style={{ marginTop: '0.75rem' }}
                      />
                      <div className="edit-actions">
                        <button
                          onClick={handleActualizarPassword}
                          className="btn-save"
                          disabled={saving}
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={cancelarEdicion}
                          className="btn-cancel"
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value-with-action">
                      <p className="info-value">••••••••</p>
                      <button
                        onClick={() => {
                          setEditandoPassword(true);
                          setEditandoTelefono(false);
                          setError('');
                          setSuccess('');
                        }}
                        className="btn-edit"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          <div className="info-card">
            <div className="info-card-header">
              <h2>Información de Registro</h2>
            </div>
            <div className="info-card-body">
              <div className="info-grid">
                <div className="info-item">
                  <label className="info-label">Fecha de Registro</label>
                  <p className="info-value">
                    {clienteInfo.created_at 
                      ? new Date(clienteInfo.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'No disponible'}
                  </p>
                </div>

                <div className="info-item">
                  <label className="info-label">Última Actualización</label>
                  <p className="info-value">
                    {clienteInfo.updated_at 
                      ? new Date(clienteInfo.updated_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'No disponible'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="info-actions">
            <button onClick={() => navigate('/')} className="btn-secondary">
              Volver al Inicio
            </button>
            <button onClick={() => logout()} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiInformacion;

