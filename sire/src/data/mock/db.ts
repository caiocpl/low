import type {
  AuditLogEntry,
  Catalog,
  Incident,
  IncidentAttachment,
  IncidentEvent,
  IncidentMilestone,
  IncidentNotification,
  IncidentOtherResource,
  IncidentPersonnel,
  IncidentStatusHistory,
  IncidentVehicle,
  IncidentVictim,
  IncidentWitness,
  IsoUtc,
} from '../../domain/types';

export const DB_SCHEMA_VERSION = 1;

/** Estrutura persistida pela demo local. Cada array corresponde a uma tabela Dataverse. */
export interface DemoDb {
  schemaVersion: number;
  seed: number;
  seededAtUTC: IsoUtc;
  catalog: Catalog;
  counters: { protocolByYear: Record<string, number> };
  incidents: Incident[];
  statusHistory: IncidentStatusHistory[];
  milestones: IncidentMilestone[];
  events: IncidentEvent[];
  vehicles: IncidentVehicle[];
  personnel: IncidentPersonnel[];
  victims: IncidentVictim[];
  witnesses: IncidentWitness[];
  otherResources: IncidentOtherResource[];
  attachments: IncidentAttachment[];
  notifications: IncidentNotification[];
  auditLog: AuditLogEntry[];
}

export interface StorageDriver {
  load(): DemoDb | null;
  save(db: DemoDb): void;
  clear(): void;
  /** Alterações feitas por outra aba/janela. */
  onExternalChange?(cb: () => void): () => void;
}

export const STORAGE_KEY = 'sire.demo.db.v1';

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly key = STORAGE_KEY) {}

  load(): DemoDb | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.key);
      if (!raw) return null;
      const db = JSON.parse(raw) as DemoDb;
      return db.schemaVersion === DB_SCHEMA_VERSION ? db : null;
    } catch {
      return null;
    }
  }

  save(db: DemoDb): void {
    globalThis.localStorage.setItem(this.key, JSON.stringify(db));
  }

  clear(): void {
    try {
      globalThis.localStorage?.removeItem(this.key);
    } catch {
      /* armazenamento indisponível: nada a limpar */
    }
  }

  onExternalChange(cb: () => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === this.key) cb();
    };
    globalThis.addEventListener?.('storage', handler);
    return () => globalThis.removeEventListener?.('storage', handler);
  }
}

export class MemoryDriver implements StorageDriver {
  private data: string | null = null;
  load(): DemoDb | null {
    return this.data ? (JSON.parse(this.data) as DemoDb) : null;
  }
  save(db: DemoDb): void {
    this.data = JSON.stringify(db);
  }
  clear(): void {
    this.data = null;
  }
}
