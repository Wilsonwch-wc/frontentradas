import axios from 'axios';
import { getApiBase } from './base';

const api = axios.create({
  baseURL: getApiBase(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Detectar si la respuesta es HTML en lugar de JSON
    if (error.response) {
      const contentType = error.response.headers['content-type'] || '';
      const responseData = error.response.data;
      
      // Si la respuesta es HTML, es probable que sea un error del servidor
      if (contentType.includes('text/html') || 
          (typeof responseData === 'string' && responseData.trim().startsWith('<'))) {
        // Si es un error 401, redirigir al login
        if (error.response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(new Error('Sesión expirada. Por favor, inicia sesión nuevamente.'));
        }
        // Para otros errores HTML, crear un error más descriptivo
        return Promise.reject(new Error(`Error del servidor (${error.response.status}). Por favor, verifica tu sesión o contacta al administrador.`));
      }
    }
    
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(new Error('Sesión expirada. Por favor, inicia sesión nuevamente.'));
    }
    
    // Si hay un error de parsing JSON (cuando se espera JSON pero se recibe HTML)
    if (error.message && error.message.includes('Unexpected token')) {
      return Promise.reject(new Error('Error de comunicación con el servidor. Por favor, verifica tu sesión o contacta al administrador.'));
    }
    
    return Promise.reject(error);
  }
);

export default api;

