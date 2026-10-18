import { test, expect, fillNewCall, countAll } from './fixtures';

const valid = {
  category: /Incêndio \/ explosão/,
  description: 'Fumaça saindo do painel elétrico da subestação, sem chamas visíveis.',
  area: 'Área Norte · Utilidades',
  location: 'Subestação elétrica SE-01',
  victims: null,
};

test('campos obrigatórios bloqueiam o registro sem gravar nada', async ({ page, consoleErrors }) => {
  void consoleErrors;
  const before = await countAll(page);
  await page.goto('#/ocorrencias/nova');
  await page.getByTestId('btn-register').click();
  const summary = page.getByTestId('validation-summary');
  await expect(summary).toBeVisible();
  for (const t of ['O que aconteceu?', 'Descrição do incidente', 'Macroárea', 'Local', 'Nome do solicitante', 'Há vítimas?']) {
    await expect(summary).toContainText(t);
  }
  await summary.getByRole('button', { name: /Descrição do incidente/ }).click();
  await expect(page.getByLabel('Descrição do incidente')).toBeFocused();
  expect(await countAll(page)).toBe(before);
});

test('vítima marcada sem quantidade, telefone inválido e data futura são rejeitados', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/ocorrencias/nova');
  await fillNewCall(page, { ...valid, victims: 1, phone: '123' });
  await page.getByLabel('Quantas?').fill('');
  await page.getByLabel('Data/hora do chamado').fill('2099-01-01T10:00');
  await page.getByTestId('btn-register').click();
  const summary = page.getByTestId('validation-summary');
  await expect(summary).toContainText('Quantidade de vítimas');
  await expect(summary).toContainText('Telefone');
  await expect(summary).toContainText('futuro');
});

test('telefone opcional ausente é aceito e clique duplo não duplica', async ({ page, consoleErrors }) => {
  void consoleErrors;
  const before = await countAll(page);
  await page.goto('#/ocorrencias/nova');
  await fillNewCall(page, { ...valid, phone: '' });
  await page.getByTestId('btn-register-continue').dblclick();
  await expect(page.getByTestId('detail-protocol')).toBeVisible();
  expect(await countAll(page)).toBe(before + 1);
});

test('rascunho fica identificado e não entra na fila ativa', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/ocorrencias/nova');
  await page.getByTestId('category-grid').getByRole('radio', { name: /Apoio preventivo/ }).click();
  await page.getByTestId('btn-draft').click();
  await expect(page.getByText('RASCUNHO — ainda não é uma ocorrência registrada')).toBeVisible();
  const proto = (await page.getByTestId('detail-protocol').textContent()) as string;
  await page.goto(`#/ocorrencias?q=${proto}`);
  await expect(page.getByText('Nenhuma ocorrência encontrada')).toBeVisible();
  await page.getByRole('button', { name: /^Rascunhos/ }).click();
  await expect(page.getByRole('link', { name: proto })).toBeVisible();
});

test('estado incompatível: marco fora de sequência é recusado', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/ocorrencias/nova');
  await fillNewCall(page, valid);
  await page.getByTestId('btn-register-continue').click();
  await page.getByRole('tab', { name: /Deslocamentos/ }).click();
  await page.getByLabel('Marco').selectOption({ label: 'Chegada no local' });
  await page.getByLabel('Data/hora').fill('2020-01-01T08:00');
  await page.getByTestId('btn-add-milestone').click();
  await expect(page.getByText('Marco não registrado')).toBeVisible();
  await expect(page.getByText(/é anterior a chamado recebido/)).toBeVisible();
});
