import { test as base, expect, type Page } from '@playwright/test';

/** Falha o teste se houver erro de console ou exceção não tratada (requisito: "não tolerar console error silencioso"). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await provide(errors);
    expect(errors, 'Erros de console durante o teste').toEqual([]);
  },
});
export { expect };

export async function asRole(page: Page, role: 'OPERADOR' | 'COORDENADOR' | 'INSPETOR' | 'ADMIN' | 'VISUALIZADOR') {
  await page.addInitScript((r) => {
    try {
      window.localStorage.setItem('sire.demo.role', r);
    } catch {
      /* ignore */
    }
  }, role);
}

export async function switchRole(page: Page, label: string) {
  await page.getByTestId('role-select').selectOption({ label });
}

export interface NewCallData {
  category: RegExp;
  description: string;
  area: string;
  location: string;
  victims: number | null;
  caller?: string;
  phone?: string;
}

export async function fillNewCall(page: Page, d: NewCallData) {
  await page.getByTestId('category-grid').getByRole('radio', { name: d.category }).click();
  await page.getByLabel('Descrição do incidente').fill(d.description);
  await page.getByLabel('Macroárea').selectOption({ label: d.area });
  await page.getByLabel('Local da ocorrência').selectOption({ label: d.location });
  const victims = page.getByRole('radiogroup', { name: 'Há vítimas?' });
  if (d.victims) {
    await victims.getByRole('radio', { name: 'Sim' }).click();
    await page.getByLabel('Quantas?').fill(String(d.victims));
    await page.getByLabel('Estado da(s) vítima(s)').fill('Consciente, dor no tornozelo');
  } else {
    await victims.getByRole('radio', { name: 'Não' }).click();
  }
  await page.getByLabel('Nome completo').fill(d.caller ?? 'Supervisor de turno');
  if (d.phone !== undefined) await page.getByLabel('Telefone').fill(d.phone);
}

export async function countAll(page: Page): Promise<number> {
  await page.goto('#/ocorrencias?status=todas');
  const chip = page.getByRole('button', { name: /^Todas \d+/ });
  await expect(chip).toBeVisible();
  const txt = (await chip.textContent()) ?? '';
  return Number(txt.replace(/\D/g, ''));
}

export async function advance(page: Page) {
  await page.getByTestId('btn-advance').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Confirmar ·/ }).click();
  await expect(dialog).toBeHidden();
}
