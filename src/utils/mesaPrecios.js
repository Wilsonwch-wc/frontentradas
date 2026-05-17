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
  // 1. Si la mesa tiene un precio fijo explícito para mesa completa, usarlo
  if (mesa?.precio_mesa_completa != null && mesa.precio_mesa_completa !== '') {
    const p = parseFloat(mesa.precio_mesa_completa);
    if (!Number.isNaN(p)) return p;
  }

  // 2. Si la mesa se vende SOLO completa (o si no tiene sillas asociadas en el array),
  //    y tiene un tipo de precio asociado, usar el precio de ese tipo de precio.
  if (esMesaSoloVentaCompleta(mesa) || !asientosDeMesa || asientosDeMesa.length === 0) {
    const tpId = mesa?.tipo_precio_id;
    const tp = tiposPrecio.find((t) => String(t.id) === String(tpId));
    if (tp?.precio != null) {
      const p = parseFloat(tp.precio);
      if (!Number.isNaN(p)) return p;
    }
  }

  // 3. De lo contrario (venta por sillas individuales), sumar el precio de cada silla
  const totalSillas = (asientosDeMesa || []).reduce((sum, a) => {
    let precioSilla = 0;
    if (mesa?.precio_silla_individual != null && mesa.precio_silla_individual !== '') {
      precioSilla = parseFloat(mesa.precio_silla_individual);
    } else {
      const tpId = a?.tipo_precio_id ?? mesa?.tipo_precio_id;
      const tp = tiposPrecio.find((t) => String(t.id) === String(tpId));
      precioSilla = parseFloat(tp?.precio) || 0;
    }
    return sum + (Number.isNaN(precioSilla) ? 0 : precioSilla);
  }, 0);

  return totalSillas;
};
