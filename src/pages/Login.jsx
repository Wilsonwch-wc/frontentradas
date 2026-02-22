import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import api from '../api/axios';
import './Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);
  const [mostrarRestablecer, setMostrarRestablecer] = useState(false);
  const [correoVerificacion, setCorreoVerificacion] = useState('');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarNuevaPassword, setConfirmarNuevaPassword] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
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
          // Mostrar notificación de éxito
          await showAlert('¡Sesión iniciada exitosamente!', { 
            type: 'success',
            title: user?.rol === 'admin' ? 'Bienvenido Administrador' : 'Bienvenido'
          });

          // Si es admin (o seguridad), llevar al dashboard admin
          if (user?.rol === 'admin' || user?.rol === 'seguridad') {
            navigate('/admin/dashboard', { replace: true });
          } else {
            const from = location.state?.from || '/';
            navigate(from, { replace: true });
          }
        } else {
          // Verificar si requiere verificación de email
          if (response.data.requiereVerificacion) {
            setCorreoVerificacion(formData.email);
            setMostrarVerificacion(true);
            setError('');
            await showAlert('Por favor, verifica tu correo electrónico antes de iniciar sesión.', {
              type: 'warning',
              title: 'Verificación requerida'
            });
          } else {
            setError(response.data.message || 'Credenciales inválidas');
          }
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

      if (response.data && response.data.success) {
        // Verificar si requiere verificación de email
        if (response.data.data && response.data.data.requiereVerificacion) {
          setCorreoVerificacion(formData.email);
          setMostrarVerificacion(true);
          setError('');
          setLoading(false);
          // No mostrar alerta aquí, solo mostrar el formulario de verificación
        } else if (response.data.data && response.data.data.token && response.data.data.user) {
          // Si no requiere verificación (caso antiguo o respuesta con token)
          const { token, user } = response.data.data;
          login(user, token);
          await showAlert('¡Cuenta creada e iniciada exitosamente!', { 
            type: 'success',
            title: 'Bienvenido'
          });
          const from = location.state?.from || '/';
          navigate(from, { replace: true });
          setLoading(false);
        } else {
          console.error('Respuesta inesperada:', response.data);
          setError('Respuesta inesperada del servidor. Por favor, intenta nuevamente.');
          setLoading(false);
        }
      } else {
        setError(response.data?.message || 'Error al registrar');
        setLoading(false);
      }
      }
    } catch (err) {
      console.error('Error en registro/login:', err);
      
      // Verificar si requiere verificación de email (en login)
      if (err.response?.data?.requiereVerificacion) {
        setCorreoVerificacion(formData.email);
        setMostrarVerificacion(true);
        setError('');
        setLoading(false);
        // No mostrar alerta aquí, solo mostrar el formulario
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Error al procesar la solicitud';
        setError(errorMessage);
        setLoading(false);
      }
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
        // Mostrar notificación de éxito
        await showAlert('¡Sesión iniciada exitosamente con Google!', { 
          type: 'success',
          title: user?.rol === 'admin' || user?.rol === 'seguridad' ? 'Bienvenido Administrador' : 'Bienvenido'
        });
        
        // Si es admin (o seguridad), llevar al dashboard admin
        if (user?.rol === 'admin' || user?.rol === 'seguridad') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          const from = location.state?.from || '/';
          navigate(from, { replace: true });
        }
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

  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!codigoVerificacion || codigoVerificacion.length !== 4) {
      setError('Por favor ingresa un código de 4 dígitos');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/clientes/verificar-codigo', {
        correo: correoVerificacion,
        codigo: codigoVerificacion
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        login(user, token);
        await showAlert('¡Correo verificado exitosamente!', {
          type: 'success',
          title: 'Verificación exitosa'
        });
        const from = location.state?.from || '/';
        navigate(from, { replace: true });
      } else {
        setError(response.data.message || 'Código inválido');
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al verificar el código';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleReenviarCodigo = async () => {
    setEnviandoCodigo(true);
    setError('');

    try {
      const response = await api.post('/clientes/reenviar-codigo', {
        correo: correoVerificacion
      });

      if (response.data.success) {
        await showAlert('Código de verificación reenviado. Por favor, revisa tu correo.', {
          type: 'success',
          title: 'Código reenviado'
        });
      } else {
        setError(response.data.message || 'Error al reenviar el código');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al reenviar el código';
      setError(errorMessage);
    } finally {
      setEnviandoCodigo(false);
    }
  };

  const handleCambiarCodigo = (e) => {
    // Solo permitir números y máximo 4 dígitos
    const valor = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCodigoVerificacion(valor);
    setError('');
  };

  const handleSolicitarRecuperacion = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email) {
      setError('Por favor ingresa tu correo electrónico');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/clientes/solicitar-recuperacion', {
        correo: formData.email
      });

      if (response.data.success) {
        setCorreoVerificacion(formData.email);
        setMostrarRecuperacion(false);
        setMostrarRestablecer(true);
        await showAlert('Código de recuperación enviado. Por favor, revisa tu correo.', {
          type: 'success',
          title: 'Código enviado'
        });
      } else {
        setError(response.data.message || 'Error al solicitar recuperación');
      }
      setLoading(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al solicitar recuperación';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleRestablecerPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!codigoRecuperacion || codigoRecuperacion.length !== 4) {
      setError('Por favor ingresa el código de 4 dígitos');
      setLoading(false);
      return;
    }

    if (!nuevaPassword || nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (nuevaPassword !== confirmarNuevaPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/clientes/restablecer-password', {
        correo: correoVerificacion,
        codigo: codigoRecuperacion,
        nuevaPassword: nuevaPassword
      });

      if (response.data.success) {
        await showAlert('Contraseña restablecida exitosamente. Ahora puedes iniciar sesión.', {
          type: 'success',
          title: 'Contraseña restablecida'
        });
        setMostrarRestablecer(false);
        setMostrarRecuperacion(false);
        setCodigoRecuperacion('');
        setNuevaPassword('');
        setConfirmarNuevaPassword('');
        setFormData({ ...formData, password: '' });
        setIsLogin(true);
      } else {
        setError(response.data.message || 'Error al restablecer contraseña');
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Error al restablecer la contraseña';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleCambiarCodigoRecuperacion = (e) => {
    const valor = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCodigoRecuperacion(valor);
    setError('');
  };

  // Si está en modo restablecer contraseña, mostrar formulario de restablecimiento
  if (mostrarRestablecer) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-box">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}>
                🔒
              </div>
            </div>
            <h1 className="login-title">Restablecer Contraseña</h1>
            <p className="login-subtitle">
              Ingresa el código enviado a
            </p>
            <p className="login-subtitle" style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#2563eb' }}>
              {correoVerificacion}
            </p>
            <p className="login-subtitle" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              y tu nueva contraseña
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleRestablecerPassword} className="login-form">
              <div className="form-group">
                <label htmlFor="codigoRecuperacion">Código de Recuperación</label>
                <input
                  type="text"
                  id="codigoRecuperacion"
                  name="codigoRecuperacion"
                  value={codigoRecuperacion}
                  onChange={handleCambiarCodigoRecuperacion}
                  placeholder="1234"
                  maxLength={4}
                  required
                  style={{
                    textAlign: 'center',
                    fontSize: '2rem',
                    letterSpacing: '0.5rem',
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="nuevaPassword">Nueva Contraseña</label>
                <input
                  type="password"
                  id="nuevaPassword"
                  name="nuevaPassword"
                  value={nuevaPassword}
                  onChange={(e) => {
                    setNuevaPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmarNuevaPassword">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  id="confirmarNuevaPassword"
                  name="confirmarNuevaPassword"
                  value={confirmarNuevaPassword}
                  onChange={(e) => {
                    setConfirmarNuevaPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className="btn-submit" disabled={loading || codigoRecuperacion.length !== 4 || nuevaPassword.length < 6 || nuevaPassword !== confirmarNuevaPassword}>
                {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarRestablecer(false);
                    setMostrarRecuperacion(true);
                    setCodigoRecuperacion('');
                    setNuevaPassword('');
                    setConfirmarNuevaPassword('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0.5rem'
                  }}
                >
                  ← Volver
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Si está en modo recuperación, mostrar formulario de solicitud
  if (mostrarRecuperacion) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-box">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}>
                🔒
              </div>
            </div>
            <h1 className="login-title">Recuperar Contraseña</h1>
            <p className="login-subtitle">
              Ingresa tu correo electrónico y te enviaremos un código de recuperación
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSolicitarRecuperacion} className="login-form">
              <div className="form-group">
                <label htmlFor="emailRecuperacion">Correo Electrónico</label>
                <input
                  type="email"
                  id="emailRecuperacion"
                  name="emailRecuperacion"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-submit" disabled={loading || !formData.email}>
                {loading ? 'Enviando...' : 'Enviar Código'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarRecuperacion(false);
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0.5rem'
                  }}
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Si está en modo verificación, mostrar formulario de verificación
  if (mostrarVerificacion) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-box">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}>
                ✉️
              </div>
            </div>
            <h1 className="login-title">Verificar Correo Electrónico</h1>
            <p className="login-subtitle">
              Hemos enviado un código de 4 dígitos a
            </p>
            <p className="login-subtitle" style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#2563eb' }}>
              {correoVerificacion}
            </p>
            <p className="login-subtitle" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              Por favor, ingresa el código para completar tu registro
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleVerificarCodigo} className="login-form">
              <div className="form-group">
                <label htmlFor="codigo">Código de Verificación</label>
                <input
                  type="text"
                  id="codigo"
                  name="codigo"
                  value={codigoVerificacion}
                  onChange={handleCambiarCodigo}
                  placeholder="1234"
                  maxLength={4}
                  required
                  style={{
                    textAlign: 'center',
                    fontSize: '2rem',
                    letterSpacing: '0.5rem',
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                  }}
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-submit" disabled={loading || codigoVerificacion.length !== 4}>
                {loading ? 'Verificando...' : 'Verificar Código'}
              </button>

              <div style={{ 
                textAlign: 'center', 
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#666' }}>
                  ¿No recibiste el código?
                </p>
                <button
                  type="button"
                  onClick={handleReenviarCodigo}
                  disabled={enviandoCodigo}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: enviandoCodigo ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  {enviandoCodigo ? 'Reenviando...' : 'Reenviar código'}
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarVerificacion(false);
                    setCodigoVerificacion('');
                    setError('');
                    setCorreoVerificacion('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0.5rem'
                  }}
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
              {isLogin && (
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarRecuperacion(true);
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
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

