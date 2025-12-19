const sanitizeEnv = (value) => {
  if (!value) return null;
  // Evita usar localhost en dispositivos de la red
  if (value.includes('localhost')) return null;
  return value;
};

export const getServerBase = () => {
  const envServer = sanitizeEnv(import.meta.env.VITE_SERVER_BASE);
  if (envServer) return envServer;

  const protocol = window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:5000`;
};

export const getApiBase = () => {
  const envApi = sanitizeEnv(import.meta.env.VITE_API_BASE);
  if (envApi) return envApi;

  const serverBase = getServerBase();
  return `${serverBase}/api`;
};

