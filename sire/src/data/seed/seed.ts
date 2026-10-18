/**
 * Gera a base de demonstração com dados SINTÉTICOS e REPRODUZÍVEIS:
 * mesmo `seed` + mesmo `now` ⇒ mesmos registros (útil para testes e roteiros de demo).
 *
 * Composição:
 *  - Histórico de ~14 dias de ocorrências encerradas/canceladas (completas e coerentes);
 *  - Um "cenário ao vivo" com ocorrências em cada etapa do fluxo, incluindo situações
 *    que disparam alertas de incompletude (rascunho parado, local sem posição, campo sem viatura).
 */
import type {
  Catalog,
  Channel,
  Incident,
  IncidentAttachment,
  IncidentEvent,
  IncidentMilestone,
  IncidentNotification,
  IncidentPersonnel,
  IncidentStatus,
  IncidentStatusHistory,
  IncidentVehicle,
  IncidentVictim,
  IncidentWitness,
  IsoUtc,
  MilestoneType,
  Role,
} from '../../domain/types';
import { formatProtocol, seededRandom, seededUuid } from '../../domain/ids';
import { MILESTONE_ORDER } from '../../domain/milestones';
import { STATUS_ORDER } from '../../domain/status';
import { DEMO_CATALOG } from './catalog';
import { ALL_SCENES, SCENE_CAPTIONS, syntheticPhoto, type SyntheticScene } from './syntheticImages';
import { DB_SCHEMA_VERSION, type DemoDb } from '../mock/db';

export const DEFAULT_SEED = 20261018;

const OPERATORS = ['Lia Monteiro', 'Rui Valente', 'Teresa Lins'];
const COORDINATOR = 'Hélio Batista';

interface Narrative {
  description: (loc: string) => string;
  classification: string;
  unfolding: string;
  agent?: string;
  qty?: string;
  area?: number;
  chemical?: string;
  summary: string;
  scenes: SyntheticScene[];
}

const NARRATIVES: Record<string, Narrative> = {
  'cat-incendio': {
    description: (l) => `Solicitante relata fumaça e chamas em painel elétrico próximo a ${l}. Área parcialmente evacuada.`,
    classification: 'Incêndio classe C em painel elétrico',
    unfolding: 'Sem propagação; equipamento isolado pela manutenção',
    agent: 'Pó químico seco (PQS)',
    qty: '2 extintores de 12 kg',
    area: 15,
    summary: 'Foco extinto com PQS após desenergização. Rescaldo e ventilação realizados; área liberada à operação.',
    scenes: ['fogo', 'viatura', 'equipe'],
  },
  'cat-vitima': {
    description: (l) => `Colaborador com mal súbito em ${l}; consciente, queixando-se de tontura.`,
    classification: 'Mal súbito',
    unfolding: 'Vítima removida ao ambulatório',
    summary: 'Vítima avaliada, estabilizada e removida ao ambulatório em condição estável.',
    scenes: ['viatura'],
  },
  'cat-altura': {
    description: (l) => `Executante com dificuldade para descer de plataforma a aproximadamente 12 m em ${l}.`,
    classification: 'Resgate técnico em altura',
    unfolding: 'Vítima descida sem lesões',
    summary: 'Sistema de descida montado; executante resgatado sem lesões e liberado pela saúde ocupacional.',
    scenes: ['equipe'],
  },
  'cat-confinado': {
    description: (l) => `Alarme de detector de gás na entrada de espaço confinado em ${l}; vigia sem contato com o executante.`,
    classification: 'Resgate em espaço confinado',
    unfolding: 'Executante retirado consciente',
    summary: 'Atmosfera monitorada, executante retirado consciente e encaminhado para avaliação.',
    scenes: ['equipe', 'area'],
  },
  'cat-quimico': {
    description: (l) => `Derrame de óleo lubrificante a partir de mangote rompido em ${l}; produto atingindo canaleta.`,
    classification: 'Derrame contido',
    unfolding: 'Contenção em canaleta e recolhimento com material absorvente',
    chemical: 'Óleo lubrificante mineral (genérico)',
    area: 8,
    summary: 'Vazamento estancado, produto contido e recolhido; resíduos destinados conforme orientação ambiental.',
    scenes: ['contencao', 'area'],
  },
  'cat-ambiental': {
    description: (l) => `Emissão visível de material particulado em ${l} durante transferência.`,
    classification: 'Emissão fugitiva',
    unfolding: 'Aspersão de água e ajuste operacional',
    area: 40,
    summary: 'Aspersão aplicada e operação ajustada; emissão cessada. Registro fotográfico anexado.',
    scenes: ['area'],
  },
  'cat-vegetacao': {
    description: (l) => `Foco de incêndio em vegetação rasteira em ${l}, com fumaça visível da via.`,
    classification: 'Incêndio em vegetação rasteira',
    unfolding: 'Combate direto e rescaldo',
    agent: 'Água',
    qty: '400 L',
    area: 350,
    summary: 'Combate direto com água e abafadores; rescaldo concluído sem reignição.',
    scenes: ['fogo', 'equipe'],
  },
  'cat-prevencao': {
    description: (l) => `Prevenção para trabalho a quente programado em ${l}.`,
    classification: 'Prevenção programada',
    unfolding: 'Atividade concluída sem intercorrências',
    summary: 'Linha preventiva mantida durante toda a atividade; sem intercorrências.',
    scenes: ['viatura'],
  },
  'cat-alarme': {
    description: (l) => `Alarme de detecção de fumaça acionado em ${l}.`,
    classification: 'Alarme sem confirmação de fogo',
    unfolding: 'Detector com acúmulo de poeira; manutenção acionada',
    summary: 'Verificação realizada; sem fogo. Detector encaminhado à manutenção.',
    scenes: [],
  },
};

type Offsets = Partial<Record<MilestoneType, number>>;

interface Builder {
  incidents: Incident[];
  statusHistory: IncidentStatusHistory[];
  milestones: IncidentMilestone[];
  events: IncidentEvent[];
  vehicles: IncidentVehicle[];
  personnel: IncidentPersonnel[];
  victims: IncidentVictim[];
  witnesses: IncidentWitness[];
  attachments: IncidentAttachment[];
  notifications: IncidentNotification[];
}

export function buildSeedDb(now: Date, seed: number = DEFAULT_SEED, catalog: Catalog = DEMO_CATALOG): DemoDb {
  const rand = seededRandom(seed);
  const id = () => seededUuid(rand);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
  const iso = (ms: number): IsoUtc => new Date(Math.floor(ms / 60000) * 60000).toISOString();

  const b: Builder = {
    incidents: [],
    statusHistory: [],
    milestones: [],
    events: [],
    vehicles: [],
    personnel: [],
    victims: [],
    witnesses: [],
    attachments: [],
    notifications: [],
  };

  const weightedCategories = [
    'cat-incendio', 'cat-incendio', 'cat-vitima', 'cat-vitima', 'cat-vitima', 'cat-altura', 'cat-confinado',
    'cat-quimico', 'cat-ambiental', 'cat-vegetacao', 'cat-vegetacao', 'cat-prevencao', 'cat-prevencao', 'cat-alarme', 'cat-alarme',
  ];
  const channels: Channel[] = ['RAMAL_EMERGENCIA', 'RAMAL_EMERGENCIA', 'RADIO', 'TELEFONE', 'SISTEMA', 'PRESENCIAL'];

  interface Spec {
    categoryId: string;
    locationId: string;
    callAt: number;
    status: IncidentStatus;
    offsets: Offsets;
    withVehicle?: boolean;
    cancelReason?: string;
    operator?: string;
  }

  const fullOffsets = (): Offsets => {
    const o: Offsets = { CHAMADO: 0 };
    o.ACIONAMENTO = (o.CHAMADO ?? 0) + int(1, 3);
    o.SAIDA_BASE = o.ACIONAMENTO + int(1, 4);
    o.CHEGADA_LOCAL = o.SAIDA_BASE + int(3, 11);
    o.INICIO_ATENDIMENTO = o.CHEGADA_LOCAL + int(0, 2);
    o.CONTROLE = o.INICIO_ATENDIMENTO + int(8, 75);
    o.TERMINO_ATENDIMENTO = o.CONTROLE + int(5, 45);
    o.SAIDA_LOCAL = o.TERMINO_ATENDIMENTO + int(2, 10);
    o.CHEGADA_BASE = o.SAIDA_LOCAL + int(3, 11);
    return o;
  };

  const specs: Spec[] = [];
  const DAY = 86400000;

  // Histórico: 14 dias, 2–4 ocorrências/dia.
  for (let d = 14; d >= 1; d--) {
    const n = int(2, 4);
    for (let k = 0; k < n; k++) {
      const categoryId = pick(weightedCategories);
      const location = pick(catalog.locations);
      let callAt = now.getTime() - d * DAY + int(0, 23) * 3600000 + int(0, 59) * 60000;
      // Garante que todo o ciclo (até ~3 h) termine antes de "agora".
      if (callAt > now.getTime() - 6 * 3600000) callAt -= 8 * 3600000;
      const cancelled = rand() < 0.08;
      specs.push({
        categoryId,
        locationId: location.id,
        callAt,
        status: cancelled ? 'CANCELADA' : 'ENCERRADA',
        offsets: cancelled ? { CHAMADO: 0, ACIONAMENTO: int(1, 3) } : fullOffsets(),
        cancelReason: cancelled ? 'Solicitante confirmou alarme falso antes do deslocamento da equipe.' : undefined,
      });
    }
  }

  // Encerradas hoje (garante indicador "encerradas no dia").
  for (const [cat, loc, minsAgo] of [
    ['cat-prevencao', 'lc-n1', 300],
    ['cat-vitima', 'lc-a2', 220],
  ] as const) {
    specs.push({ categoryId: cat, locationId: loc, callAt: now.getTime() - minsAgo * 60000, status: 'ENCERRADA', offsets: fullOffsets() });
  }

  // Cenário ao vivo (relativo a "agora").
  const live: Spec[] = [
    { categoryId: 'cat-incendio', locationId: 'lc-o2', callAt: now.getTime() - 96 * 60000, status: 'CONTROLADA', offsets: { CHAMADO: 0, ACIONAMENTO: 1, SAIDA_BASE: 3, CHEGADA_LOCAL: 9, INICIO_ATENDIMENTO: 10, CONTROLE: 52 } },
    { categoryId: 'cat-vegetacao', locationId: 'lc-e1', callAt: now.getTime() - 38 * 60000, status: 'EM_ATENDIMENTO', offsets: { CHAMADO: 0, ACIONAMENTO: 2, SAIDA_BASE: 5, CHEGADA_LOCAL: 17, INICIO_ATENDIMENTO: 18 } },
    { categoryId: 'cat-altura', locationId: 'lc-f2', callAt: now.getTime() - 24 * 60000, status: 'EM_ATENDIMENTO', offsets: { CHAMADO: 0, ACIONAMENTO: 1, SAIDA_BASE: 4, CHEGADA_LOCAL: 11, INICIO_ATENDIMENTO: 12 }, withVehicle: false },
    { categoryId: 'cat-vitima', locationId: 'lc-s2', callAt: now.getTime() - 9 * 60000, status: 'EM_DESLOCAMENTO', offsets: { CHAMADO: 0, ACIONAMENTO: 1, SAIDA_BASE: 3 } },
    { categoryId: 'cat-quimico', locationId: 'lc-l2', callAt: now.getTime() - 5 * 60000, status: 'ACIONADA', offsets: { CHAMADO: 0, ACIONAMENTO: 2 } },
    { categoryId: 'cat-alarme', locationId: 'lc-a1', callAt: now.getTime() - 2 * 60000, status: 'REGISTRADA', offsets: { CHAMADO: 0 } },
    { categoryId: 'cat-prevencao', locationId: 'lc-n2', callAt: now.getTime() - 52 * 60000, status: 'RASCUNHO', offsets: { CHAMADO: 0 } },
  ];
  specs.push(...live);
  specs.sort((a, b2) => a.callAt - b2.callAt);

  const protocolByYear: Record<string, number> = {};

  for (const spec of specs) {
    const cat = catalog.categories.find((c) => c.id === spec.categoryId);
    const loc = catalog.locations.find((l) => l.id === spec.locationId);
    if (!cat || !loc) continue;
    const area = catalog.areas.find((a) => a.id === loc.areaId);
    const baseId = area?.preferredBaseId ?? 'base-central';
    const narrative = NARRATIVES[cat.id] as Narrative;
    const incidentId = id();
    const operator = spec.operator ?? pick(OPERATORS);
    const callIso = iso(spec.callAt);
    const year = new Date(spec.callAt).getUTCFullYear();
    protocolByYear[year] = (protocolByYear[year] ?? 0) + 1;
    const protocol = formatProtocol(year, protocolByYear[year] as number);
    const statusIdx = STATUS_ORDER.indexOf(spec.status);
    const reached = (s: IncidentStatus) => spec.status !== 'CANCELADA' && statusIdx >= STATUS_ORDER.indexOf(s);
    const closed = spec.status === 'ENCERRADA';
    const hasVictims = cat.id === 'cat-vitima' || (cat.id === 'cat-confinado' && rand() < 0.6);
    const victimCount = hasVictims ? (rand() < 0.85 ? 1 : 2) : null;
    const at = (m: MilestoneType) => (spec.offsets[m] !== undefined ? iso(spec.callAt + (spec.offsets[m] as number) * 60000) : null);
    const lastMilestone = [...MILESTONE_ORDER].reverse().find((m) => spec.offsets[m] !== undefined) ?? 'CHAMADO';
    const updatedAt = at(lastMilestone) ?? callIso;
    const isDraft = spec.status === 'RASCUNHO';

    const incident: Incident = {
      id: incidentId,
      protocol,
      idempotencyKey: `seed-${incidentId}`,
      status: spec.status,
      callReceivedAtUTC: callIso,
      operatorName: operator,
      channel: pick(channels),
      categoryId: cat.id,
      priority: cat.defaultPriority,
      phase: cat.defaultPhase,
      title: `${cat.name} · ${loc.name}`,
      description: narrative.description(loc.name),
      callerName: isDraft ? '' : pick(['Supervisor de turno', 'Operador da área', 'Técnico de segurança', 'Vigia de espaço confinado', 'Não identificado']),
      callerPhone: rand() < 0.6 ? `(00) 9${int(1000, 9999)}-${int(1000, 9999)}` : '',
      hasVictims,
      victimCount,
      victimConditionSummary: hasVictims ? 'Consciente e orientada, queixa de dor leve' : '',
      areaId: loc.areaId,
      locationId: loc.id,
      reference: pick(['Próximo ao portão de acesso', 'Lado oposto à escada principal', 'Em frente à sala de controle', '']),
      suggestedBaseId: area?.preferredBaseId ?? null,
      responsibleBaseId: reached('EM_TRIAGEM') || spec.status === 'CANCELADA' ? baseId : null,
      teamId: reached('ACIONADA') ? pick(catalog.teams).id : null,
      classification: closed || spec.status === 'CONTROLADA' ? narrative.classification : '',
      unfolding: closed ? narrative.unfolding : '',
      extinguishingAgent: closed || spec.status === 'CONTROLADA' ? narrative.agent ?? '' : '',
      extinguishingQty: closed ? narrative.qty ?? '' : '',
      affectedAreaM2: closed && narrative.area !== undefined ? narrative.area + int(0, 20) : null,
      chemicalProduct: closed ? narrative.chemical ?? '' : '',
      paeItem: closed ? `Item PAE ${int(1, 9)}.${int(1, 9)} (exemplo)` : '',
      attended: closed ? true : spec.status === 'CANCELADA' ? false : null,
      closingSummary: closed ? narrative.summary : '',
      cancelReason: spec.cancelReason ?? '',
      closedAtUTC: closed ? at('TERMINO_ATENDIMENTO') : spec.status === 'CANCELADA' ? at('ACIONAMENTO') : null,
      createdAtUTC: callIso,
      updatedAtUTC: updatedAt,
      createdBy: operator,
      updatedBy: closed ? COORDINATOR : operator,
      source: 'SEED_DEMO',
      isDemo: true,
      rowVersion: 1,
      isDeleted: false,
    };
    b.incidents.push(incident);

    // Marcos
    if (!isDraft) {
      for (const m of MILESTONE_ORDER) {
        const t = at(m);
        if (!t) continue;
        b.milestones.push({ id: id(), incidentId, type: m, atUTC: t, vehicleId: null, actorName: operator, recordedAtUTC: t, isDeleted: false });
      }
    }

    // Histórico de status (coerente com os marcos)
    const statusTime: Partial<Record<IncidentStatus, IsoUtc | null>> = {
      RASCUNHO: callIso,
      REGISTRADA: iso(spec.callAt + 60000 * 0.5),
      EM_TRIAGEM: iso(spec.callAt + 60000 * 0.8),
      ACIONADA: at('ACIONAMENTO'),
      EM_DESLOCAMENTO: at('SAIDA_BASE'),
      EM_ATENDIMENTO: at('INICIO_ATENDIMENTO'),
      CONTROLADA: at('CONTROLE'),
      ENCERRADA: at('TERMINO_ATENDIMENTO'),
    };
    let prev: IncidentStatus | null = null;
    const target = spec.status === 'CANCELADA' ? 'ACIONADA' : spec.status;
    for (const s of STATUS_ORDER) {
      if (STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(target)) break;
      // Ocorrências registradas diretamente não passam por rascunho (mesmo comportamento do app).
      if (s === 'RASCUNHO' && target !== 'RASCUNHO') continue;
      const t = statusTime[s] ?? callIso;
      const actorRole: Role = s === 'ENCERRADA' ? 'COORDENADOR' : 'OPERADOR';
      b.statusHistory.push({ id: id(), incidentId, fromStatus: prev, toStatus: s, atUTC: t, actorName: s === 'ENCERRADA' ? COORDINATOR : operator, actorRole, reason: '' });
      prev = s;
    }
    if (spec.status === 'CANCELADA') {
      b.statusHistory.push({
        id: id(), incidentId, fromStatus: 'ACIONADA', toStatus: 'CANCELADA', atUTC: at('ACIONAMENTO') ?? callIso,
        actorName: COORDINATOR, actorRole: 'COORDENADOR', reason: spec.cancelReason ?? '',
      });
    }
    if (isDraft) continue;

    // Acionamentos registrados
    cat.suggestedTargets.slice(0, reached('ACIONADA') ? cat.suggestedTargets.length : 1).forEach((targetId, i) => {
      b.notifications.push({ id: id(), incidentId, targetId, atUTC: iso(spec.callAt + (1 + i) * 60000), actorName: operator, note: 'Acionamento simulado (demo)', isDeleted: false });
    });

    // Recursos em campo
    if (reached('EM_DESLOCAMENTO') && spec.withVehicle !== false) {
      const baseVehicles = catalog.vehicles.filter((v) => v.baseId === baseId);
      const v1 = baseVehicles[0] ?? pick(catalog.vehicles);
      const km = int(10000, 60000);
      b.vehicles.push({ id: id(), incidentId, vehicleId: v1.id, kmStart: km, kmEnd: closed ? km + int(2, 25) : null, isDeleted: false });
      const team = catalog.people.filter((p) => p.baseId === baseId).slice(0, int(2, 4));
      const crew = team.length ? team : catalog.people.slice(0, 3);
      crew.forEach((p, i) =>
        b.personnel.push({ id: id(), incidentId, personId: p.id, functionInIncident: i === 0 ? 'Líder de equipe' : 'Combatente / socorrista', isDeleted: false }),
      );
    }
    if (hasVictims && (closed || reached('EM_DESLOCAMENTO'))) {
      for (let v = 0; v < (victimCount ?? 0); v++) {
        b.victims.push({
          id: id(), incidentId, pseudonym: `Vítima ${v + 1}`, condition: v === 0 ? 'CONSCIENTE' : 'FERIMENTO_LEVE',
          destination: closed ? 'AMBULATORIO' : 'ATENDIDA_NO_LOCAL', bond: pick(['PROPRIO', 'CONTRATADO'] as const), notes: '', isDeleted: false,
        });
      }
    }
    if (closed && rand() < 0.35) {
      b.witnesses.push({
        id: id(), incidentId, name: pick(['Testemunha fictícia A', 'Testemunha fictícia B']),
        statement: 'Relata ter percebido o evento e acionado o ramal de emergência imediatamente.', takenAtUTC: at('CONTROLE') ?? callIso, isDeleted: false,
      });
    }
    const scenes = closed || spec.status === 'CONTROLADA' ? narrative.scenes : [];
    scenes.forEach((scene, i) => {
      const dataUrl = syntheticPhoto(scene, i + 1);
      b.attachments.push({
        id: id(), incidentId, fileName: `sintetica-${scene}-${i + 1}.svg`, caption: SCENE_CAPTIONS[scene], mimeType: 'image/svg+xml',
        dataUrl, isSynthetic: true, sizeBytes: dataUrl.length, addedAtUTC: at('CONTROLE') ?? callIso, actorName: operator, isDeleted: false,
      });
    });

    b.events.push({ id: id(), incidentId, type: 'SISTEMA', atUTC: callIso, actorName: operator, text: `Chamado registrado via ${incident.channel === 'RADIO' ? 'rádio' : 'central'}.` });
    if (reached('EM_ATENDIMENTO')) {
      b.events.push({ id: id(), incidentId, type: 'NOTA', atUTC: at('INICIO_ATENDIMENTO') ?? callIso, actorName: operator, text: 'Equipe no local iniciou avaliação de cenário e isolamento da área.' });
    }
    if (reached('CONTROLADA')) {
      b.events.push({ id: id(), incidentId, type: 'NOTA', atUTC: at('CONTROLE') ?? callIso, actorName: operator, text: 'Líder de equipe informa situação sob controle.' });
    }
  }

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    seed,
    seededAtUTC: now.toISOString(),
    catalog: structuredCloneSafe(catalog),
    counters: { protocolByYear },
    ...b,
    otherResources: [],
    auditLog: [],
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export { ALL_SCENES };
