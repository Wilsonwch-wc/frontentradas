import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Account.css';

const Account = () => {
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Verificar si ya hay una sesión activa y es admin
  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated() && isAdmin()) {
        navigate('/admin/dashboard', { replace: true });
      }
    };
    checkAuth();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validación básica
    if (!formData.nombre_usuario || !formData.password) {
      setError('Por favor completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      // Llamada al backend para autenticar
      const response = await api.post('/auth/login', {
        nombre_usuario: formData.nombre_usuario,
        password: formData.password
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        
        // Verificar que sea admin
        if (user.rol !== 'admin') {
          setError('Solo los administradores pueden acceder a este panel');
          setLoading(false);
          return;
        }

        // Guardar datos del usuario y token
        login(user, token);
        
        // Usar window.location para forzar la recarga y asegurar la redirección
        window.location.href = '/admin/dashboard';
      } else {
        setError(response.data.message || 'Credenciales inválidas');
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al iniciar sesión. Intenta nuevamente.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-box">
          <div className="account-header">
            <div className="admin-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 className="account-title">Panel de Administración</h1>
            <p className="account-subtitle">
              Ingresa con tus credenciales de administrador
            </p>
            <p style={{ fontSize: '0.85rem', color: '#95a5a6', marginTop: '0.5rem' }}>
              Usuario: admin | Contraseña: admin123
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="account-form">
            <div className="form-group">
              <label htmlFor="nombre_usuario">Nombre de Usuario</label>
              <input
                type="text"
                id="nombre_usuario"
                name="nombre_usuario"
                value={formData.nombre_usuario}
                onChange={handleChange}
                placeholder="admin"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="account-footer">
            <p className="account-note">
              Solo personal autorizado puede acceder a esta sección
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;

