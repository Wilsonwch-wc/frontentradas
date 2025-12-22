const sanitizeEnv = (value) => {
  if (!value) return null;
  // Evita usar localhost en dispositivos de la red
  if (value.includes('localhost')) return null;
  return value;
};

export const getServerBase = () => {
  const envServer = sanitizeEnv(import.meta.env.VITE_SERVER_BASE);
  if (envServer) {
    // Si es una ruta relativa (empieza con /), retornarla tal cual
    if (envServer.startsWith('/')) return envServer;
    return envServer;
  }

  // Detectar si estamos en desarrollo local
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  
  if (isLocalhost) {
    // En desarrollo local, usar el backend en puerto 5000
    return 'http://localhost:5000';
  }

  // En producción, usar ruta relativa (las imágenes se servirán desde el mismo dominio)
  return '';
};

export const getApiBase = () => {
  const envApi = sanitizeEnv(import.meta.env.VITE_API_BASE);
  if (envApi) {
    // Si es una ruta relativa (empieza con /), retornarla tal cual
    if (envApi.startsWith('/')) return envApi;
    return envApi;
  }

  // Si no hay variable de entorno, usar ruta relativa
  return '/api';
};

