import { test, expect, asRole, switchRole } from './fixtures';

test('visualizador não registra nem altera (UI e fonte de dados)', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await asRole(page, 'VISUALIZADOR');
  await page.goto('#/');
  await expect(page.getByTestId('btn-new-call')).toHaveCount(0);
  await page.goto('#/ocorrencias/nova');
  await expect(page.getByText('Acesso restrito ao seu perfil')).toBeVisible();
  await page.goto('#/ocorrencias');
  await page.getByRole('link', { name: /PAE-/ }).first().click();
  await expect(page.getByText('Modo leitura')).toBeVisible();
  await expect(page.getByTestId('btn-advance')).toHaveCount(0);
  await expect(page.getByTestId('btn-cancel')).toHaveCount(0);
});

test('exportação de integração restrita a coordenação; reinício restrito ao administrador', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/integracao');
  await expect(page.getByText('Acesso restrito ao seu perfil')).toBeVisible();
  await switchRole(page, 'Coordenador');
  await expect(page.getByRole('heading', { name: 'Tabelas do contrato' })).toBeVisible();
  await page.goto('#/admin');
  await expect(page.getByTestId('btn-reset')).toHaveCount(0);
  await switchRole(page, 'Administrador');
  await page.getByTestId('btn-reset').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar demonstração' }).click();
  await expect(page.getByText('Demonstração reiniciada')).toBeVisible();
});

test('alertas de incompletude e mapa sem coordenada usam alternativa segura', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/');
  const alerts = page.getByTestId('alerts');
  await expect(alerts).toContainText('Rascunho sem registro');
  await expect(alerts).toContainText('sem viatura vinculada');
  await expect(alerts).toContainText('sem posição cadastrada');
  await expect(page.getByTestId('map-fallback')).toContainText('Localização não informada');
});

test('indisponibilidade simulada: erro claro e nenhuma gravação', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await asRole(page, 'ADMIN');
  await page.goto('#/admin');
  await page.getByTestId('btn-outage').click();
  await page.goto('#/ocorrencias');
  await expect(page.getByText('Não foi possível carregar')).toBeVisible();
  await expect(page.getByText(/Serviço de dados indisponível/)).toBeVisible();
  await page.goto('#/admin');
  await page.getByTestId('btn-outage').click();
  await page.goto('#/ocorrencias');
  await expect(page.getByRole('link', { name: /PAE-/ }).first()).toBeVisible();
});

test('busca universal (Ctrl+K) encontra ocorrência por protocolo e navega por teclado', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();
  await input.fill('PAE-');
  await expect(page.getByRole('option').filter({ hasText: 'PAE-' }).first()).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page).toHaveURL(/#\/ocorrencias/);
});
