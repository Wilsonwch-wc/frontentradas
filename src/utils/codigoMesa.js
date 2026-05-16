/** Una letra de fila: A, B, C… */
export const normalizarLetraMesa = (letra) => {
  const L = String(letra || 'A')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return L.charAt(0) || 'A';
};

/** Siguiente código libre para esa letra (A1, A2… según mesas ya en el plano) */
export const obtenerSiguienteCodigoMesa = (listaMesas, letra) => {
  const L = normalizarLetraMesa(letra);
  let maxN = 0;
  (listaMesas || []).forEach((m) => {
    const cod = String(m.codigo_mesa || '').toUpperCase();
    const match = cod.match(new RegExp(`^${L}(\\d+)$`));
    if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
  });
  return `${L}${maxN + 1}`;
};
