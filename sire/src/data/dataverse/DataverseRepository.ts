/**
 * Adaptador FUTURO para Dataverse (Power Apps Code App).
 *
 * Situação: NÃO CONECTADO. Este ambiente de desenvolvimento não possui credenciais,
 * ambiente Power Platform nem Dataverse provisionado. A classe existe para:
 *  1. fixar o contrato (implementa `SireRepository`, então a UI não muda na troca);
 *  2. documentar o mapeamento tabela/coluna (ver `schema.ts`);
 *  3. falhar de forma explícita e segura se for ativada sem configuração.
 *
 * Passos para implementar (detalhados em docs/REQUISITOS_POWER_PLATFORM.md):
 *  - `pa app init --environment-id <id> --display-name "SIRE (demo)"`
 *  - criar as tabelas `sire_*` na solução (ver docs/DICIONARIO_DADOS.md);
 *  - `pa app add data-source --connector dataverse --table sire_incident` (repetir por tabela);
 *  - substituir cada método abaixo pelos serviços tipados gerados pelo `pa` em `src/generated/`;
 *  - mover regras de autorização para Funções de segurança + regras de negócio/plug-ins
 *    (a checagem no cliente vira apenas conveniência de UX).
 */
import type { SireRepository } from '../repository';
import { NotConfiguredError } from '../errors';

const notConfigured = () => Promise.reject(new NotConfiguredError('A conexão com o Dataverse'));

export class DataverseRepository implements SireRepository {
  readonly kind = 'dataverse' as const;
  getCatalog = notConfigured;
  listIncidents = notConfigured;
  getIncident = notConfigured;
  getOperationalDataset = notConfigured;
  createIncident = notConfigured;
  updateIncident = notConfigured;
  transitionIncident = notConfigured;
  recordMilestone = notConfigured;
  removeMilestone = notConfigured;
  addChild = notConfigured;
  removeChild = notConfigured;
  addNote = notConfigured;
  listAudit = notConfigured;
  exportIntegration = notConfigured;
  resetDemo = notConfigured;
  subscribe(): () => void {
    return () => undefined;
  }
}
