// Teste automatizado isolado: todas as APIs externas e o WhatsApp são interceptados.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const writes = [], errors = [];
    const cases = [
      { email: 'ana@example.com', name: 'Ana Exemplo', turma: 'Sexta', topic: 'mensalidade', reference: '2026-08', phone: '5511999990000', reason: 'Sem pagamento registrado', status: 'Pendente', joinedKnown: true },
      { email: 'bia@example.com', name: 'Bia <Exemplo>', turma: 'Sábado', topic: 'presenca', reference: '2026-08-29', phone: '', phoneIssue: 'Telefone não vinculado.', reason: 'Sem presença registrada', status: 'Pendente', joinedKnown: false }
    ].map(c => ({ ...c, key: JSON.stringify([c.email, c.topic, c.reference]) }));
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
    await page.getByText('Dados atualizados. Nenhuma mensagem foi enviada.').waitFor();
    await page.locator('[data-select]').first().click();
    assert.equal(await page.locator('[data-save-contact]').isDisabled(), true);
    assert.equal(writes.length, 0);
    await page.locator('[data-message]').fill('Oi, Ana! Você pode conferir a mensalidade de agosto?');
    assert.match(await page.locator('[data-whatsapp]').getAttribute('href'), /^https:\/\/wa.me\/5511999990000\?text=Oi/);
    const popupPromise = page.waitForEvent('popup');
    await page.locator('[data-whatsapp]').click();
    const popup = await popupPromise; await popup.close();
    assert.equal(writes.length, 0, 'abrir WhatsApp não deve gravar envio');
    await page.locator('[data-confirm]').check();
    await page.locator('[data-save-contact]').click();
    await page.getByText('Contato registrado por sua confirmação. Nenhum envio automático.').waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].type, 'contato');
    await page.locator('[data-status]').selectOption('Resolvido');
    await page.locator('[data-save-status]').click();
    await page.getByText('Situação salva. Nenhum contato foi marcado como realizado.').waitFor();
    assert.equal(writes.length, 2); assert.equal(writes[1].type, 'atualizacao');
    await page.locator('[data-select]').first().click();
    assert.equal(await page.locator('[data-whatsapp]').getAttribute('href'), null);
    assert.ok((await page.locator('[data-detail]').textContent()).includes('Bia <Exemplo>'));
    await page.screenshot({ path: path.join(__dirname, '../artifacts/followup-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, '../artifacts/followup-mobile.png'), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'tela não pode ter rolagem horizontal no celular');
    assert.deepEqual(errors, []);
    console.log('OK: acesso direto do administrador, navegação, link manual, nenhum envio automático, registro separado, resolução, telefone ausente, escape HTML e layout desktop/celular.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
