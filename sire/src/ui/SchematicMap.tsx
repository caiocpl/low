import type { Catalog, Incident } from '../domain/types';
import { Icon } from './Icon';
import { STATUS_LABEL } from '../domain/status';

/**
 * Planta ESQUEMÁTICA e FICTÍCIA (plano 1000×600). Não representa geografia real.
 * Locais sem posição cadastrada nunca recebem um ponto inventado: aparecem na lista alternativa.
 */
const ZONES: Record<string, { x: number; y: number; w: number; h: number }> = {
  'ar-norte': { x: 160, y: 40, w: 280, h: 150 },
  'ar-oeste': { x: 60, y: 230, w: 230, h: 200 },
  'ar-adm': { x: 420, y: 140, w: 160, h: 110 },
  'ar-ferrovia': { x: 580, y: 260, w: 160, h: 190 },
  'ar-sul': { x: 400, y: 440, w: 230, h: 130 },
  'ar-leste': { x: 740, y: 180, w: 190, h: 200 },
};

export interface MapMarker {
  id: string;
  locationId: string | null;
  label: string;
  tone: 'critical' | 'warning' | 'info' | 'success';
}

const TONE_COLOR = { critical: '#b42318', warning: '#d48806', info: '#1d5aa0', success: '#0b6b45' } as const;

export function incidentMarker(i: Incident): MapMarker {
  const tone = i.status === 'EM_ATENDIMENTO' ? 'critical' : i.status === 'CONTROLADA' ? 'success' : i.status === 'ACIONADA' || i.status === 'EM_DESLOCAMENTO' ? 'warning' : 'info';
  return { id: i.id, locationId: i.locationId, label: `${i.protocol} · ${STATUS_LABEL[i.status]}`, tone };
}

export function SchematicMap({
  catalog,
  markers = [],
  highlightLocationId,
  showBases = true,
  title = 'Planta esquemática (fictícia)',
  compact = false,
}: {
  catalog: Catalog;
  markers?: MapMarker[];
  highlightLocationId?: string | null;
  showBases?: boolean;
  title?: string;
  compact?: boolean;
}) {
  const locById = new Map(catalog.locations.map((l) => [l.id, l]));
  const placed = markers.filter((m) => m.locationId && locById.get(m.locationId)?.point);
  const unplaced = markers.filter((m) => !m.locationId || !locById.get(m.locationId)?.point);
  const highlight = highlightLocationId ? locById.get(highlightLocationId) : undefined;
  const basesWithoutPoint = catalog.bases.filter((b) => !b.point);

  return (
    <div className="stack-sm">
      <div className="map-wrap">
        <svg viewBox="0 0 1000 600" role="img" aria-label={`${title}. ${placed.length} ponto(s) posicionado(s)${unplaced.length ? `, ${unplaced.length} sem posição` : ''}.`}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#dbe5e4" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#grid)" />
          <path d="M950 0 C 930 150 970 300 940 600 L1000 600 L1000 0 Z" fill="#cfe3ea" />
          <text x="975" y="300" fontSize="14" fill="#5b7f8a" transform="rotate(90 975 300)" textAnchor="middle">
            canal de acesso (ilustrativo)
          </text>
          <path d="M30 210 H 960 M 380 20 V 590 M 560 120 L 760 470" stroke="#c3cfcf" strokeWidth="10" fill="none" strokeLinecap="round" />
          {catalog.areas.map((a) => {
            const z = ZONES[a.id];
            if (!z) return null;
            return (
              <g key={a.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="10" fill="#ffffff" stroke="#b7c7c6" strokeDasharray="6 4" />
                <text x={z.x + 10} y={z.y + 22} fontSize="15" fontWeight="600" fill="#3a5253">
                  {a.name.split('·')[0]?.trim()}
                </text>
              </g>
            );
          })}
          {catalog.locations.map((l) =>
            l.point ? (
              <g key={l.id}>
                <circle cx={l.point.x} cy={l.point.y} r={highlight?.id === l.id ? 9 : 4} fill={highlight?.id === l.id ? '#00a88f' : '#8aa3a2'} />
                {!compact || highlight?.id === l.id ? (
                  <text x={l.point.x + 10} y={l.point.y + 4} fontSize="12" fill="#4f6667">
                    {l.name}
                  </text>
                ) : null}
              </g>
            ) : null,
          )}
          {showBases
            ? catalog.bases.map((b) =>
                b.point ? (
                  <g key={b.id} aria-label={b.name}>
                    <rect x={b.point.x - 11} y={b.point.y - 11} width="22" height="22" rx="5" fill="#007e79" />
                    <path d={`M${b.point.x - 5} ${b.point.y + 4} V ${b.point.y - 2} L ${b.point.x} ${b.point.y - 6} L ${b.point.x + 5} ${b.point.y - 2} V ${b.point.y + 4} Z`} fill="#fff" />
                    <text x={b.point.x + 15} y={b.point.y - 8} fontSize="13" fontWeight="700" fill="#00655f">
                      {b.name}
                    </text>
                  </g>
                ) : null,
              )
            : null}
          {placed.map((m) => {
            const p = locById.get(m.locationId as string)?.point as { x: number; y: number };
            return (
              <g key={m.id}>
                <circle cx={p.x} cy={p.y} r="16" fill={TONE_COLOR[m.tone]} opacity="0.18" />
                <circle cx={p.x} cy={p.y} r="8" fill={TONE_COLOR[m.tone]} stroke="#fff" strokeWidth="2" />
                <title>{m.label}</title>
              </g>
            );
          })}
        </svg>
        <div className="map-legend">
          <span>
            <span className="legend-dot" style={{ background: '#007e79', borderRadius: 3 }} />
            Base / posto
          </span>
          <span>
            <span className="legend-dot" style={{ background: TONE_COLOR.critical }} />
            Em atendimento
          </span>
          <span>
            <span className="legend-dot" style={{ background: TONE_COLOR.warning }} />
            Acionada / deslocamento
          </span>
          <span>
            <span className="legend-dot" style={{ background: TONE_COLOR.info }} />
            Registrada / triagem
          </span>
          <span>
            <span className="legend-dot" style={{ background: TONE_COLOR.success }} />
            Controlada
          </span>
          <span className="grow" style={{ textAlign: 'right' }}>
            Planta fictícia · sem coordenadas reais
          </span>
        </div>
      </div>
      {highlightLocationId && highlight && !highlight.point ? <MapFallback items={[{ id: 'h', label: highlight.name, detail: 'Localização não informada no cadastro — nenhum ponto foi inventado.' }]} /> : null}
      {unplaced.length ? (
        <MapFallback
          items={unplaced.map((m) => ({ id: m.id, label: m.label, detail: m.locationId ? `${locById.get(m.locationId)?.name ?? 'Local'} · Localização não informada` : 'Local não informado' }))}
        />
      ) : null}
      {showBases && basesWithoutPoint.length && !compact ? (
        <p className="subtle">
          <Icon name="info" size={14} /> Base(s) sem posição cadastrada: {basesWithoutPoint.map((b) => b.name).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

/** Alternativa segura quando não há posição confiável: lista em vez de ponto inventado. */
export function MapFallback({ items }: { items: { id: string; label: string; detail: string }[] }) {
  return (
    <div className="alert tone-warning" data-testid="map-fallback">
      <Icon name="pin" />
      <div className="grow">
        <div className="alert-title">Sem posição no mapa ({items.length})</div>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <strong>{i.label}</strong> — {i.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
