import AxeBuilder from '@axe-core/playwright';
import { test, expect, asRole } from './fixtures';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];
const PAGES = ['#/', '#/ocorrencias', '#/ocorrencias/nova', 'DETALHE', '#/integracao', '#/admin'];

for (const vp of VIEWPORTS) {
  test(`sem rolagem horizontal acidental · ${vp.name}`, async ({ page, consoleErrors }) => {
    void consoleErrors;
    await asRole(page, 'COORDENADOR');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of PAGES) {
      if (p === 'DETALHE') {
        await page.goto('#/ocorrencias');
        await page.locator('a[href^="#/ocorrencias/"]:visible').filter({ hasText: /PAE-/ }).first().click();
        await expect(page.getByTestId('detail-protocol')).toBeVisible();
      } else {
        await page.goto(p);
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow horizontal em ${p}`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('demo-banner')).toBeVisible();
    }
  });
}

test('acessibilidade automática (axe) sem violações graves nas telas principais', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await asRole(page, 'COORDENADOR');
  const results: string[] = [];
  for (const p of ['#/', '#/ocorrencias', '#/ocorrencias/nova', '#/integracao', '#/admin']) {
    await page.goto(p);
    await page.waitForTimeout(700);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      results.push(`${p} · ${v.id} (${v.impact}): ${v.nodes.length} nó(s) — ${v.nodes[0]?.target.join(' ')}`);
    }
  }
  expect(results).toEqual([]);
});
