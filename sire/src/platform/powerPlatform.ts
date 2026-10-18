/**
 * Detecção do host Power Apps (Code App) usando o SDK oficial `@microsoft/power-apps`.
 *
 * Fora do host (execução local `npm run dev`/`preview`), o SDK não tem a quem responder;
 * por isso só o consultamos quando há indício de host e sempre com tempo-limite.
 * O resultado é apenas informativo nesta fase: a identidade da demo continua SIMULADA.
 */
export interface PlatformInfo {
  host: 'power-apps' | 'local';
  userName: string | null;
  environmentId: string | null;
  dataverseOrgUrl: string | null;
}

const LOCAL: PlatformInfo = { host: 'local', userName: null, environmentId: null, dataverseOrgUrl: null };

function looksHosted(): boolean {
  try {
    const inFrame = window.self !== window.top;
    const params = new URLSearchParams(window.location.search);
    return inFrame || params.has('_powerapps') || import.meta.env.VITE_POWERAPPS_HOST === 'true';
  } catch {
    return true; // acesso ao window.top bloqueado ⇒ quase certamente dentro de um iframe de host
  }
}

export async function detectPlatform(timeoutMs = 2500): Promise<PlatformInfo> {
  if (!looksHosted()) return LOCAL;
  try {
    const { getContext } = await import('@microsoft/power-apps/app');
    const ctx = await Promise.race([
      getContext(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return {
      host: 'power-apps',
      userName: ctx.user.fullName ?? null,
      environmentId: ctx.app.environmentId ?? null,
      dataverseOrgUrl: ctx.app.dataverseOrgUrl ?? null,
    };
  } catch {
    return LOCAL;
  }
}
