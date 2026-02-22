import { createContext, useState, useContext, useEffect, useRef } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

// Tiempo de inactividad en milisegundos (2 horas = 7200000ms, 1 hora = 3600000ms)
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Verificar cada minuto

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const activityCheckIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Función para actualizar la última actividad
  const updateLastActivity = () => {
    lastActivityRef.current = Date.now();
    const loginTime = localStorage.getItem('loginTime');
    if (loginTime) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }
  };

  // Función para cerrar sesión automáticamente
  const handleAutoLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('lastActivity');
      
      // Limpiar timers
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
      
      // Redirigir al login
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin')) {
        window.location.href = '/account';
      } else {
        window.location.href = '/login';
      }
    }
  };

  // Función para verificar inactividad y cerrar sesión si es necesario
  const checkInactivity = () => {
    const loginTime = localStorage.getItem('loginTime');
    const lastActivity = localStorage.getItem('lastActivity') || loginTime;
    
    if (!loginTime || !lastActivity) {
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - parseInt(lastActivity);
    const timeSinceLogin = now - parseInt(loginTime);

    // Si ha pasado más tiempo del permitido desde la última actividad O desde el login
    if (timeSinceLastActivity > INACTIVITY_TIMEOUT || timeSinceLogin > INACTIVITY_TIMEOUT) {
      console.log('Sesión cerrada por inactividad');
      handleAutoLogout();
    }
  };

  // Configurar listeners de actividad del usuario
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    // Agregar listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, true);
    });

    // Verificar inactividad periódicamente
    activityCheckIntervalRef.current = setInterval(() => {
      checkInactivity();
    }, ACTIVITY_CHECK_INTERVAL);

    // Limpiar listeners al desmontar
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity, true);
      });
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    // Verificar si hay una sesión guardada
    try {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      const loginTime = localStorage.getItem('loginTime');
      
      // Validar que savedUser no sea "undefined" o "null" como string
      if (savedUser && savedUser !== 'undefined' && savedUser !== 'null' && savedToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          
          // Verificar si la sesión ha expirado por tiempo
          if (loginTime) {
            const timeSinceLogin = Date.now() - parseInt(loginTime);
            if (timeSinceLogin > INACTIVITY_TIMEOUT) {
              // Sesión expirada, limpiar y no verificar token
              setUser(null);
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              localStorage.removeItem('loginTime');
              localStorage.removeItem('lastActivity');
              setLoading(false);
              return;
            }
          }
          
          setUser(parsedUser);
          // Verificar token con el backend
          verifyToken();
        } catch (parseError) {
          console.error('Error al parsear usuario del localStorage:', parseError);
          // Limpiar datos inválidos
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('loginTime');
          localStorage.removeItem('lastActivity');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('lastActivity');
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr || userStr === 'undefined' || userStr === 'null') {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('lastActivity');
        setLoading(false);
        return;
      }
      
      const savedUser = JSON.parse(userStr);
      
      // Verificar si es admin o cliente
      if (savedUser.rol) {
        // Es admin, verificar con /auth/verify
        const response = await api.get('/auth/verify');
        if (response.data.success) {
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
          // Actualizar timestamp de última actividad al verificar
          updateLastActivity();
        } else {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('loginTime');
          localStorage.removeItem('lastActivity');
        }
      } else if (savedUser.correo) {
        // Es cliente, verificar con /clientes/verify
        const response = await api.get('/clientes/verify');
        if (response.data.success) {
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
          // Actualizar timestamp de última actividad al verificar
          updateLastActivity();
        } else {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('loginTime');
          localStorage.removeItem('lastActivity');
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('lastActivity');
      }
    } catch (error) {
      console.error('Error al verificar token:', error);
      if (error.response?.status === 401) {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('lastActivity');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, token) => {
    const now = Date.now();
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    localStorage.setItem('loginTime', now.toString());
    localStorage.setItem('lastActivity', now.toString());
    lastActivityRef.current = now;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('lastActivity');
      
      // Limpiar timers
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    }
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const rol = (user?.rol || '').toLowerCase();

  const isAdmin = () => rol === 'admin';

  const isVendedor = () => rol === 'vendedor';

  const canSellWithVerification = () => rol === 'admin' || rol === 'vendedor';

  const hasRole = (role) => (role && (user?.rol || '').toLowerCase() === (role || '').toLowerCase());

  const value = {
    user,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isVendedor,
    canSellWithVerification,
    hasRole,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

