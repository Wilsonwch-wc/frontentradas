/** Mesa vendida solo como paquete completo (no sillas sueltas) */
export const esMesaSoloVentaCompleta = (mesa) =>
  mesa?.venta_solo_mesa === 1 || mesa?.venta_solo_mesa === true;

/** Precio de una silla suelta en esa mesa */
export const calcularPrecioSillaEnMesa = (mesa, asiento, tiposPrecio = []) => {
  if (mesa && esMesaSoloVentaCompleta(mesa)) return null;

  if (mesa?.precio_silla_individual != null && mesa.precio_silla_individual !== '') {
    const p = parseFloat(mesa.precio_silla_individual);
    if (!Number.isNaN(p)) return p;
  }

  const tpId = asiento?.tipo_precio_id ?? mesa?.tipo_precio_id;
  const tp = tiposPrecio.find((t) => String(t.id) === String(tpId));
  return parseFloat(tp?.precio) || 0;
};

/** Precio al comprar la mesa entera con todas sus sillas */
export const calcularPrecioMesaCompleta = (mesa, asientosDeMesa = [], tiposPrecio = []) => {
  if (mesa?.precio_mesa_completa != null && mesa.precio_mesa_completa !== '') {
    const p = parseFloat(mesa.precio_mesa_completa);
    if (!Number.isNaN(p)) return p;
  }

  return asientosDeMesa.reduce(
    (sum, a) => sum + calcularPrecioSillaEnMesa(mesa, a, tiposPrecio),
    0
  );
};
