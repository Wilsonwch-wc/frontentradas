import { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

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

  useEffect(() => {
    // Verificar si hay una sesión guardada
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      // Verificar token con el backend
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Verificar si es admin o cliente
      if (savedUser.rol) {
        // Es admin, verificar con /auth/verify
        const response = await api.get('/auth/verify');
        if (response.data.success) {
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        } else {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } else if (savedUser.correo) {
        // Es cliente, verificar con /clientes/verify
        const response = await api.get('/clientes/verify');
        if (response.data.success) {
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        } else {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error al verificar token:', error);
      if (error.response?.status === 401) {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
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
    }
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const isAdmin = () => {
    return user?.rol === 'admin';
  };

  const hasRole = (role) => {
    return user?.rol === role;
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    hasRole,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

