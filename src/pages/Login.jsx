import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Verificar si ya hay una sesión activa
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

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

    try {
      if (isLogin) {
        // Login
        if (!formData.email || !formData.password) {
          setError('Por favor completa todos los campos');
          setLoading(false);
          return;
        }

        const response = await api.post('/clientes/login', {
          correo: formData.email,
          password: formData.password
        });

        if (response.data.success) {
          const { token, user } = response.data.data;
          login(user, token);
          const from = location.state?.from || '/';
          navigate(from, { replace: true });
        } else {
          setError(response.data.message || 'Credenciales inválidas');
          setLoading(false);
        }
      } else {
        // Registro
        if (!formData.nombre || !formData.email || !formData.password) {
          setError('Por favor completa todos los campos');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }

        const response = await api.post('/clientes/registro', {
          nombre_completo: formData.nombre,
          correo: formData.email,
          password: formData.password
        });

        if (response.data.success) {
          const { token, user } = response.data.data;
          login(user, token);
          const from = location.state?.from || '/';
          navigate(from, { replace: true });
        } else {
          setError(response.data.message || 'Error al registrar');
          setLoading(false);
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al procesar la solicitud';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError('');

      if (!credentialResponse?.credential) {
        setError('No se recibió el token de Google. Por favor, intenta nuevamente.');
        setLoading(false);
        return;
      }

      console.log('🔐 Enviando token de Google al backend...');

      // Enviar el ID token de Google al backend
      const apiResponse = await api.post('/clientes/google', {
        token: credentialResponse.credential
      });

      if (apiResponse.data.success) {
        console.log('✅ Login exitoso con Google');
        const { token, user } = apiResponse.data.data;
        login(user, token);
        const from = location.state?.from || '/';
        navigate(from, { replace: true });
      } else {
        const errorMsg = apiResponse.data.message || 'Error al autenticar con Google';
        console.error('❌ Error en respuesta:', errorMsg);
        setError(errorMsg);
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error al autenticar con Google:', err);
      console.error('📋 Detalles del error:', err.response?.data);
      
      let errorMessage = 'Error al autenticar con Google';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Error al iniciar sesión con Google');
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <h1 className="login-title">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h1>
          <p className="login-subtitle">
            {isLogin 
              ? 'Ingresa a tu cuenta para continuar' 
              : 'Crea una cuenta para comenzar'}
          </p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="nombre">Nombre Completo</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Juan Pérez"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="correo@ejemplo.com"
                required
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
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required={!isLogin}
                />
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </button>
          </form>

          <div className="login-divider">
            <span>o</span>
          </div>

          <div className="google-login-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              locale="es"
            />
          </div>

          <div className="login-switch">
            <p>
              {isLogin ? '¿No tienes una cuenta? ' : '¿Ya tienes una cuenta? '}
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({
                    nombre: '',
                    email: '',
                    password: '',
                    confirmPassword: ''
                  });
                }}
                className="switch-link"
              >
                {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

