// Teste automatizado isolado: todas as APIs externas e o WhatsApp são interceptados.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
async function main() {
  fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const writes = [], errors = [];
    const cases = [
      { email: 'ana@example.com', name: 'Ana Exemplo', turma: 'Sexta', topic: 'mensalidade', reference: '2026-08', phone: '5511999990000', reason: 'Sem pagamento registrado', status: 'Pendente', joinedKnown: true },
      { email: 'bia@example.com', name: 'Bia <Exemplo>', turma: 'Sábado', topic: 'presenca', reference: '2026-08-29', phone: '', phoneIssue: 'Telefone não vinculado.', reason: 'Sem presença registrada', status: 'Pendente', joinedKnown: false }
    ].map(c => ({ ...c, key: JSON.stringify([c.email, c.topic, c.reference]) }));
    cases.push({ ...cases[0], reference: '2026-07', key: 'second-payment' });
    cases.push({ ...cases[1], reference: '2026-08-22', key: 'second-presence' });
    const history = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.hostname === 'wa.me') return route.fulfill({ contentType: 'text/html', body: '<p>Conversa simulada. Nenhuma mensagem enviada.</p>' });
      if (!url.hostname.includes('script.google')) return route.abort();
      const payload = route.request().postDataJSON();
      const action = url.searchParams.get('action') || payload?.action;
      let response = { status: 'success', data: [] };
      if (action === 'getFollowupData') response.data = { cases, history, today: '2026-09-05', isMaster: true, warning: 'Confira o cadastro antes de contatar. Dados fictícios para demonstração.' };
      if (action === 'saveFollowupEvent') {
        writes.push(payload.data);
        const item = cases.find(c => c.email === payload.data.email && c.topic === payload.data.topic);
        item.status = payload.data.status;
        history.unshift({ ...payload.data, name: item.name, at: '2026-09-05T15:00:00Z', author: 'admin@example.com', message: payload.data.type === 'contato' ? payload.data.message : '' });
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/sistema/');
    await page.evaluate(async () => {
      localStorage.setItem('tuig_role', 'master_admin');
      const { renderAdminDashboard } = await import('/sistema/src/admin.js');
      await renderAdminDashboard('admin@example.com');
    });
    await page.getByRole('button', { name: 'Acompanhamento', exact: true }).click();
    await page.locator('.fu-case').first().waitFor();
    assert.equal(await page.locator('.fu-case').count(), 2, 'presenças da mesma pessoa devem ser agrupadas');
    assert.equal(await page.locator('[data-detail], [data-confirm], [data-save-contact], [data-history]').count(), 0);
    assert.ok((await page.locator('.fu-case').first().textContent()).includes('+5511999990000'));
    assert.match(await page.locator('.fu-case').first().textContent(), /agosto\/2026, julho\/2026/);
    assert.equal(await page.locator('[data-feedback]').textContent(), '');
    const link = page.locator('[data-whatsapp]').first();
    const url = new URL(await link.getAttribute('href'));
    assert.equal(url.pathname, '/5511999990000');
    assert.match(url.searchParams.get('text'), /Oi, Ana!/);
    assert.match(url.searchParams.get('text'), /agosto\/2026/);
    assert.match(url.searchParams.get('text'), /julho\/2026/);
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise; await popup.close();
    assert.equal(writes.length, 0, 'abrir WhatsApp não deve gravar nem enviar mensagens');
    const missingPhone = page.locator('.fu-case').nth(1);
    assert.equal(await missingPhone.locator('button').isDisabled(), true);
    assert.ok((await missingPhone.textContent()).includes('Bia <Exemplo>'));
    assert.ok((await missingPhone.textContent()).includes('22/08/2026'));
    assert.ok((await missingPhone.textContent()).includes('29/08/2026'));
    await page.locator('[name=search]').fill('5511999990000');
    assert.equal(await page.locator('.fu-case').count(), 1);
    await page.locator('[name=search]').fill('');
    await page.locator('[name=topic]').selectOption('presenca');
    assert.equal(await page.locator('.fu-case').count(), 1);
    const message = await page.evaluate(async () => {
      const { messageFor } = await import('/sistema/src/followup.js');
      return messageFor({ name: 'Bia Exemplo', topic: 'presenca', references: ['2026-08-22', '2026-08-29'] });
    });
    assert.match(message, /22\/08\/2026, 29\/08\/2026/);
    await page.locator('[name=topic]').selectOption('');
    await page.screenshot({ path: path.join(__dirname, '../artifacts/followup-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, '../artifacts/followup-mobile.png'), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'tela não pode ter rolagem horizontal no celular');
    assert.deepEqual(errors, []);
    console.log('OK: lista simplificada, telefone, mensagem pronta, agrupamento de presenças, filtros, telefone ausente, escape HTML e layout desktop/celular.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
