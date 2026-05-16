/** Etiqueta visible de la mesa (A1, B15…) o M{n} si no hay código */
export const etiquetaMesa = (mesa) => {
  const codigo = mesa?.codigo_mesa != null ? String(mesa.codigo_mesa).trim() : '';
  if (codigo) return codigo;
  if (mesa?.numero_mesa != null && mesa.numero_mesa !== '') return `M${mesa.numero_mesa}`;
  return '?';
};
