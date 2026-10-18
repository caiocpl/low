import type { Base, Catalog } from '../../domain/types';

export interface BaseSuggestion {
  base: Base;
  reason: string;
}

/**
 * Base sugerida — APENAS ILUSTRATIVA. Regra de exemplo:
 *  1) base preferencial configurada para a macroárea;
 *  2) senão, base mais próxima na planta esquemática (distância euclidiana);
 *  3) senão, nenhuma sugestão (operador define manualmente).
 * Nunca é aplicada automaticamente: o operador confirma.
 */
export function suggestBase(catalog: Catalog, areaId: string | null, locationId: string | null): BaseSuggestion | null {
  const area = catalog.areas.find((a) => a.id === areaId);
  if (area?.preferredBaseId) {
    const base = catalog.bases.find((b) => b.id === area.preferredBaseId);
    if (base) return { base, reason: `Base preferencial configurada para ${area.name.split('·')[0]?.trim()}` };
  }
  const loc = catalog.locations.find((l) => l.id === locationId);
  if (loc?.point) {
    let best: { base: Base; d: number } | null = null;
    for (const b of catalog.bases) {
      if (!b.point) continue;
      const d = Math.hypot(b.point.x - loc.point.x, b.point.y - loc.point.y);
      if (!best || d < best.d) best = { base: b, d };
    }
    if (best) return { base: best.base, reason: 'Base mais próxima na planta esquemática (critério ilustrativo)' };
  }
  return null;
}
