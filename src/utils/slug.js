/**
 * Convierte un texto a slug (URL-friendly)
 * Ejemplo: "GRUPO FRONTERA" -> "grupo-frontera"
 */
export const generarSlug = (texto) => {
  if (!texto) return '';
  
  return texto
    .toString()
    .toLowerCase()
    .trim()
    // Reemplazar espacios y guiones múltiples por un solo guion
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    // Eliminar caracteres especiales excepto guiones
    .replace(/[^\w\-]+/g, '')
    // Eliminar guiones al inicio y final
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

