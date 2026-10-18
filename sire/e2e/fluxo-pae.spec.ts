import { test, expect, fillNewCall, switchRole, advance } from './fixtures';

test('roteiro 1 — chamado com vítima fictícia, do registro ao PDF e aos indicadores', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/');
  const closedBefore = Number(await page.getByTestId('metric-closed-today').textContent());

  // A2 — novo chamado
  await page.getByTestId('btn-new-call').click();
  await expect(page.getByRole('heading', { name: /Novo chamado/ })).toBeVisible();
  await fillNewCall(page, {
    category: /Ocorrência com vítima/,
    description: 'Colaborador caiu da escada de acesso e relata dor no tornozelo esquerdo.',
    area: 'Área Norte · Utilidades',
    location: 'Casa de compressores',
    victims: 1,
  });
  await expect(page.getByTestId('guidance')).toContainText('Ocorrência com vítima');
  await expect(page.getByTestId('base-suggestion')).toContainText('Base Norte');
  await page.getByTestId('btn-register-continue').click();

  // A3 — detalhe: protocolo, UUID e persistência após recarregar
  const protocol = page.getByTestId('detail-protocol');
  await expect(protocol).toHaveText(/^PAE-\d{4}-\d{6}$/);
  const proto = (await protocol.textContent()) as string;
  const url = page.url();
  expect(url).toMatch(/#\/ocorrencias\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByTestId('detail-protocol')).toHaveText(proto);

  // Triagem → acionamento (base e equipe) → deslocamento (viatura)
  await advance(page); // Em triagem
  await page.getByTestId('btn-advance').click();
  await page.getByLabel('Equipe acionada').selectOption({ label: 'Turno A' });
  await page.getByRole('dialog').getByRole('button', { name: /^Confirmar ·/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByTestId('btn-advance').click();
  await page.getByLabel('Viatura que saiu').selectOption({ index: 1 });
  await page.getByRole('dialog').getByRole('button', { name: /^Confirmar ·/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await advance(page); // Em atendimento (chegada + início)

  // A4 — efetivo, vítima, testemunha, anexo, anotação
  await page.getByRole('tab', { name: /Efetivo/ }).click();
  await page.getByLabel('Pessoa (fictícia)').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByRole('tab', { name: /Efetivo/ })).toContainText('1');

  await page.getByRole('tab', { name: /Vítimas/ }).click();
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('1 de 1 vítima(s) detalhada(s)')).toBeVisible();

  await page.getByRole('tab', { name: /Testemunhas/ }).click();
  await page.getByLabel('Testemunha (nome fictício)').fill('Testemunha fictícia C');
  await page.getByLabel('Depoimento').fill('Viu o colaborador escorregar no degrau molhado e chamou a central.');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByRole('tab', { name: /Testemunhas/ })).toContainText('1');

  await page.getByRole('tab', { name: /Anexos/ }).click();
  await page.getByTestId('btn-add-synthetic').click();
  await expect(page.getByRole('tab', { name: /Anexos/ })).toContainText('1');

  await page.getByRole('tab', { name: /Deslocamentos/ }).click();
  await page.getByLabel('Nova anotação').fill('Vítima imobilizada pela equipe; aguardando remoção.');
  await page.getByTestId('btn-add-note').click();
  await expect(page.getByText('Vítima imobilizada pela equipe; aguardando remoção.')).toBeVisible();

  await advance(page); // Controlada

  // Dados para o encerramento
  await page.getByRole('tab', { name: 'Dados' }).click();
  await page.getByTestId('btn-edit-data').click();
  await page.getByLabel('Classificação').fill('Queda de mesmo nível');
  await page.getByRole('radiogroup', { name: 'Ocorrência atendida?' }).getByRole('radio', { name: 'Sim' }).click();
  await page.getByTestId('btn-save-data').click();
  await expect(page.getByTestId('btn-edit-data')).toBeVisible();

  // Operador não encerra; Coordenador encerra com checklist
  await expect(page.getByTestId('advance-locked')).toContainText('Encerramento exige Coordenador');
  await switchRole(page, 'Coordenador');
  await page.getByTestId('btn-advance').click();
  const close = page.getByRole('dialog');
  await expect(page.getByTestId('btn-confirm-close')).toBeDisabled();
  await close.getByLabel('Resumo de encerramento').fill('Vítima imobilizada e removida ao ambulatório em condição estável; área liberada.');
  await expect(page.getByTestId('closure-checklist')).not.toContainText('pendente');
  await page.getByTestId('btn-confirm-close').click();
  await expect(close).toBeHidden();
  await expect(page.getByText(/^Encerrada em/)).toBeVisible();

  // A5 — PDF
  await page.getByTestId('btn-report').click();
  await expect(page.getByTestId('pdf-preview')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-download-pdf').click()]);
  expect(download.suggestedFilename()).toBe(`SIRE_${proto}_DEMO.pdf`);
  await page.getByRole('button', { name: 'Fechar' }).first().click();

  // Indicadores locais e lista
  await page.goto('#/');
  await expect(page.getByTestId('metric-closed-today')).toHaveText(String(closedBefore + 1));
  await page.goto(`#/ocorrencias?status=encerradas&q=${proto}`);
  await expect(page.getByRole('link', { name: proto })).toBeVisible();

  // Cadeia de dados → registro de integração
  await page.goto('#/integracao');
  await expect(page.getByTestId('integration-row')).toContainText(proto);
  await expect(page.getByTestId('integration-row')).toContainText('"status_codigo": "ENCERRADA"');
});

test('roteiro 2 — atendimento sem vítima com cancelamento justificado', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('#/ocorrencias/nova');
  await fillNewCall(page, {
    category: /Alarme \/ verificação/,
    description: 'Alarme de fumaça acionado no refeitório, sem fumaça visível segundo o solicitante.',
    area: 'Área Administrativa',
    location: 'Refeitório central',
    victims: null,
  });
  await page.getByTestId('btn-register').click();
  await expect(page.getByTestId('created-confirmation')).toBeVisible();
  const proto = (await page.getByTestId('created-protocol').textContent()) as string;
  await page.getByRole('button', { name: 'Abrir ocorrência' }).click();
  await expect(page.getByTestId('detail-protocol')).toHaveText(proto);

  await page.getByTestId('btn-cancel').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Justificativa').fill('curto');
  await expect(dialog.getByRole('button', { name: 'Cancelar ocorrência' })).toBeDisabled();
  await dialog.getByLabel('Justificativa').fill('Alarme falso confirmado pelo solicitante antes do deslocamento.');
  await dialog.getByRole('button', { name: 'Cancelar ocorrência' }).click();
  await expect(page.getByText(/^Cancelada em/)).toBeVisible();
  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.getByRole('cell', { name: 'Alarme falso confirmado pelo solicitante antes do deslocamento.' })).toBeVisible();
});
