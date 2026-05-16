/**
 * Calcula el recorte (viewBox) del plano para la compra de entradas.
 * Con zona seleccionada: acerca y centra sobre esa área (y asientos si hay muchos).
 */
export function calcularViewportPlano(evento, zonaSeleccionadaId) {
  const hojaAncho = evento?.hoja_ancho ? Number(evento.hoja_ancho) : 1000;
  const hojaAlto = evento?.hoja_alto ? Number(evento.hoja_alto) : 600;

  if (!evento || !zonaSeleccionadaId || !Array.isArray(evento.areas) || evento.areas.length === 0) {
    return { minX: 0, minY: 0, worldW: hojaAncho, worldH: hojaAlto };
  }

  const area = evento.areas.find((a) => String(a.id) === String(zonaSeleccionadaId));
  if (!area || area.posicion_x == null || area.posicion_y == null) {
    return { minX: 0, minY: 0, worldW: hojaAncho, worldH: hojaAlto };
  }

  let x1 = area.posicion_x;
  let y1 = area.posicion_y;
  let x2 = x1 + (area.ancho || 0);
  let y2 = y1 + (area.alto || 0);

  // Incluir escenario si está justo encima de la zona
  if (
    evento.escenario_x != null &&
    evento.escenario_y != null &&
    evento.escenario_width &&
    evento.escenario_height
  ) {
    const esX = evento.escenario_x;
    const esY = evento.escenario_y;
    const esW = evento.escenario_width;
    const esH = evento.escenario_height;
    const escenarioCerca = esY + esH >= y1 - 150;
    const solapaHorizontal =
      esX + esW >= x1 - 80 && esX <= x2 + 80;
    if (escenarioCerca && solapaHorizontal) {
      x1 = Math.min(x1, esX);
      y1 = Math.min(y1, esY);
      x2 = Math.max(x2, esX + esW);
      y2 = Math.max(y2, esY + esH);
    }
  }

  // Ajustar al contenido real (asientos/mesas) dentro del área
  const puntos = [];
  for (const a of evento.asientos || []) {
    const x = a.x ?? a.posicion_x;
    const y = a.y ?? a.posicion_y;
    if (x == null || y == null) continue;
    if (x >= area.posicion_x && x <= area.posicion_x + area.ancho &&
        y >= area.posicion_y && y <= area.posicion_y + area.alto) {
      puntos.push({ x, y });
    }
  }
  for (const m of evento.mesas || []) {
    const mx = m.posicion_x ?? m.x;
    const my = m.posicion_y ?? m.y;
    if (mx == null || my == null) continue;
    const mw = m.ancho || m.width || 30;
    const mh = m.alto || m.height || 30;
    const cx = mx + mw / 2;
    const cy = my + mh / 2;
    if (puntoDentroArea(cx, cy, area)) {
      puntos.push({ x: mx, y: my }, { x: mx + mw, y: my + mh });
    }
  }

  if (puntos.length >= 4) {
    const px1 = Math.min(...puntos.map((p) => p.x));
    const py1 = Math.min(...puntos.map((p) => p.y));
    const px2 = Math.max(...puntos.map((p) => p.x));
    const py2 = Math.max(...puntos.map((p) => p.y));
    const margen = 14;
    x1 = Math.max(area.posicion_x, px1 - margen);
    y1 = Math.max(area.posicion_y, py1 - margen);
    x2 = Math.min(area.posicion_x + area.ancho, px2 + margen);
    y2 = Math.min(area.posicion_y + area.alto, py2 + margen);
  }

  const anchoZona = x2 - x1;
  const altoZona = y2 - y1;
  const padX = Math.max(12, anchoZona * 0.05);
  const padY = Math.max(12, altoZona * 0.06);

  const minX = Math.max(0, x1 - padX);
  const minY = Math.max(0, y1 - padY);
  const maxX = Math.min(hojaAncho, x2 + padX);
  const maxY = Math.min(hojaAlto, y2 + padY);

  return {
    minX,
    minY,
    worldW: Math.max(60, maxX - minX),
    worldH: Math.max(60, maxY - minY),
  };
}

function puntoDentroArea(x, y, area) {
  return (
    x >= area.posicion_x &&
    x <= area.posicion_x + area.ancho &&
    y >= area.posicion_y &&
    y <= area.posicion_y + area.alto
  );
}

/** Tamaño en pantalla del SVG según si hay zoom por zona */
export function calcularTamanoSvgPlano(viewport, zonaSeleccionadaId) {
  const aspect = viewport.worldW / viewport.worldH || 1;
  if (zonaSeleccionadaId) {
    const maxW = 1100;
    const maxH = 700;
    if (aspect >= 1) {
      return { width: maxW, height: Math.max(280, Math.round(maxW / aspect)) };
    }
    return { width: Math.max(360, Math.round(maxH * aspect)), height: maxH };
  }
  return { width: 800, height: 600 };
}

export function escenarioVisibleEnViewport(evento, viewport) {
  if (
    evento?.escenario_x == null ||
    evento?.escenario_y == null ||
    !evento?.escenario_width ||
    !evento?.escenario_height
  ) {
    return false;
  }
  const { minX, minY, worldW, worldH } = viewport;
  const maxX = minX + worldW;
  const maxY = minY + worldH;
  const esX2 = evento.escenario_x + evento.escenario_width;
  const esY2 = evento.escenario_y + evento.escenario_height;
  return !(
    esX2 < minX ||
    evento.escenario_x > maxX ||
    esY2 < minY ||
    evento.escenario_y > maxY
  );
}
