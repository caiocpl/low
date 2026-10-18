import { createContext, useContext } from 'react';
import type { Actor, Catalog, IncidentAggregate } from '../../../domain/types';
import { useMutation, useRepo, useSession } from '../../../app/services';
import { useToast } from '../../../ui/Toast';
import { ValidationFailedError, toUserMessage, ConflictError } from '../../../data/errors';
import type { FieldError } from '../../../domain/validation';
import type { Permission } from '../../../domain/permissions';
import type { SireRepository } from '../../../data/repository';

export interface DetailContextValue {
  agg: IncidentAggregate;
  catalog: Catalog;
  reload: () => void;
  /** Pode registrar recursos/marcos/notas (mesma regra aplicada no repositório). */
  writable: boolean;
}

export const DetailContext = createContext<DetailContextValue | null>(null);

export function useDetail(): DetailContextValue {
  const ctx = useContext(DetailContext);
  if (!ctx) throw new Error('useDetail fora de DetailContext');
  return ctx;
}

export function computeWritable(agg: IncidentAggregate, can: (p: Permission) => boolean): boolean {
  const s = agg.incident.status;
  if (s === 'CANCELADA') return false;
  if (s === 'ENCERRADA') return can('incident.correctClosed');
  return can('incident.addResources');
}

/**
 * Executa uma operação no repositório com feedback padronizado:
 * sucesso → toast; validação → devolve erros de campo; outros → toast de erro (sem detalhes internos).
 */
export function useRepoAction() {
  const repo = useRepo();
  const { actor } = useSession();
  const toast = useToast();
  const m = useMutation(
    async (
      fn: (repo: SireRepository, actor: Actor) => Promise<unknown>,
      opts: { success?: string; successDetail?: string; onFieldErrors?: (e: FieldError[]) => void },
    ): Promise<boolean> => {
      try {
        await fn(repo, actor);
        if (opts.success) toast.success(opts.success, opts.successDetail);
        return true;
      } catch (e) {
        if (e instanceof ValidationFailedError && opts.onFieldErrors) {
          opts.onFieldErrors(e.errors);
        } else if (e instanceof ValidationFailedError) {
          toast.error('Verifique os dados', e.errors.map((x) => x.message).join(' '));
        } else if (e instanceof ConflictError) {
          toast.error('Registro desatualizado', e.message);
        } else {
          toast.error('Operação não concluída', toUserMessage(e));
        }
        return false;
      }
    },
  );
  return { act: async (...args: Parameters<typeof m.run>) => (await m.run(...args)) === true, pending: m.pending };
}
