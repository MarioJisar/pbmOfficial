// utils.js - Funciones de cálculo compartidas
export function calcularPuntos(stats) {
  if (!stats) return 0;
  return stats.goles * 3 + stats.asistencias * 2 + stats.mvps * 5;
}

export function calcularCoste(puntos) {
  return puntos > 0 ? Math.ceil(puntos * 0.8) : 1;
}