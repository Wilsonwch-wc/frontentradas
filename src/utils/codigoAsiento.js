export const normalizarLetraAsiento = (letra) => {
  const L = String(letra || 'A')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return L.charAt(0) || 'A';
};

export const obtenerSiguienteCodigoAsiento = (listaAsientos, letra) => {
  const L = normalizarLetraAsiento(letra);
  let maxN = 0;
  (listaAsientos || []).forEach((a) => {
    const cod = String(a.codigo_asiento || a.numero_asiento || '').toUpperCase();
    const match = cod.match(new RegExp(`^${L}(\\d+)$`));
    if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
  });
  return `${L}${maxN + 1}`;
};
