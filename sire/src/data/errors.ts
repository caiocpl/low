import type { FieldError, ClosureCheck } from '../domain/validation';

/** Erros de negócio expostos à UI. Mensagens são seguras para o usuário (sem detalhes internos). */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TRANSITION' | 'STORAGE' | 'UNAVAILABLE' | 'NOT_CONFIGURED',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationFailedError extends AppError {
  constructor(readonly errors: FieldError[]) {
    super('Há campos a corrigir antes de salvar.', 'VALIDATION');
  }
}

export class ForbiddenError extends AppError {
  constructor(action: string) {
    super(`Seu perfil não tem permissão para: ${action}.`, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(`${what} não encontrado(a).`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor() {
    super('Este registro foi alterado em outra sessão. Recarregue para ver a versão atual antes de salvar.', 'CONFLICT');
  }
}

export class TransitionError extends AppError {
  constructor(message: string, readonly checks: ClosureCheck[] = []) {
    super(message, 'TRANSITION');
  }
}

export class StorageError extends AppError {
  constructor(message = 'Não foi possível gravar os dados neste navegador (espaço local esgotado). Remova anexos ou reinicie a demonstração.') {
    super(message, 'STORAGE');
  }
}

export class UnavailableError extends AppError {
  constructor() {
    super('Serviço de dados indisponível no momento. Nenhuma alteração foi gravada — tente novamente.', 'UNAVAILABLE');
  }
}

export class NotConfiguredError extends AppError {
  constructor(what: string) {
    super(`${what} ainda não está configurado neste ambiente.`, 'NOT_CONFIGURED');
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return 'Erro inesperado. Nenhum detalhe técnico foi exposto; tente novamente ou reinicie a demonstração.';
}
