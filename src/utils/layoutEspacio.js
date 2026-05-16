export const HOJA_LIMITS = {
  minAncho: 800,
  minAlto: 600,
  maxAncho: 8000,
  maxAlto: 6000,
};

export const HOJA_PRESETS = [
  { label: 'Mediano', ancho: 1200, alto: 800 },
  { label: 'Grande', ancho: 2500, alto: 1800 },
  { label: 'Muy grande', ancho: 4000, alto: 2800 },
  { label: 'Evento masivo', ancho: 6000, alto: 4200 },
  { label: 'Máximo', ancho: 8000, alto: 6000 },
];

export const MAX_ELEMENTOS_ZONA = 15000;

export const COLOR_AREA_DEFAULT = '#F5E6B8';

export const COLORES_AREA_PRESETS = [
  { nombre: 'Beige', hex: '#F5E6B8' },
  { nombre: 'Naranja', hex: '#FFB74D' },
  { nombre: 'Amarillo', hex: '#FFF176' },
  { nombre: 'Verde claro', hex: '#A5D6A7' },
  { nombre: 'Azul claro', hex: '#90CAF9' },
  { nombre: 'Rosa', hex: '#F48FB1' },
  { nombre: 'Lavanda', hex: '#CE93D8' },
  { nombre: 'Gris claro', hex: '#E0E0E0' },
  { nombre: 'Blanco', hex: '#FAFAFA' },
];

/** Convierte #RRGGBB a rgba para rellenar áreas con transparencia */
export const hexToRgba = (hex, alpha = 0.82) => {
  if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`;
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(200, 200, 200, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(200, 200, 200, ${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

export const clampHojaDim = (ancho, alto) => ({
  ancho: Math.min(HOJA_LIMITS.maxAncho, Math.max(HOJA_LIMITS.minAncho, Math.round(Number(ancho) || HOJA_LIMITS.minAncho))),
  alto: Math.min(HOJA_LIMITS.maxAlto, Math.max(HOJA_LIMITS.minAlto, Math.round(Number(alto) || HOJA_LIMITS.minAlto))),
});

/** Tamaños de iconos según escala (0.4 = muy pequeño, 1.2 = grande) */
export const calcularTamanosLayout = (escala = 0.55) => {
  const e = Math.min(1.2, Math.max(0.4, Number(escala) || 0.55));
  const persona = Math.max(3, Math.round(5 * e));
  const asiento = Math.max(3, Math.round(5 * e));
  const silla = Math.max(3, Math.round(5 * e));
  const mesaBase = Math.max(12, Math.round(16 * e));
  return {
    escala: e,
    persona,
    asiento,
    silla,
    mesaCuad: mesaBase,
    mesaRectW: Math.max(14, Math.round(mesaBase * 1.35)),
    mesaRectH: Math.max(10, Math.round(mesaBase * 0.85)),
    espacioGrid: Math.max(1, Math.round(2 * e)),
    paddingZona: Math.max(4, Math.round(6 * e)),
    distanciaMesaSilla: Math.max(2, Math.round(2 * e)),
    espacioEntreMesas: Math.max(10, Math.round(14 * e)),
    radioPersona: persona / 2,
    halfAsiento: asiento / 2,
    halfSilla: silla / 2,
    pasoGrid: persona + Math.max(1, Math.round(2 * e)),
  };
};
