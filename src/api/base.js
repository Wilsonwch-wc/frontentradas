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

  // Si no hay variable de entorno, usar ruta relativa para producción
  // Las imágenes/archivos estáticos se servirán desde el mismo dominio
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

