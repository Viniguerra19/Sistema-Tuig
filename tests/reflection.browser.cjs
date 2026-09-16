const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function main() {
  const source = vm.createContext({}); vm.runInContext(fs.readFileSync('Code.gs', 'utf8'), source);
  const questions = vm.runInContext('REFLECTION_QUESTIONS', source);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
    const errors = [], writes = []; let submission = null;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJHkAAAAASUVORK5CYII=', 'base64');
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (!url.hostname.includes('script.google')) return route.abort();
      const payload = route.request().postDataJSON();
      const action = url.searchParams.get('action') || payload?.action;
      let data = [];
      if (action === 'getReflection') data = { questions, submission };
      if (action === 'saveReflection') {
        writes.push(payload.data);
        submission = { id: payload.data.id, at: '2026-09-13T20:00:00Z', mode: payload.data.mode, answers: payload.data.answers || [], hasPhoto: payload.data.mode === 'photo' };
        data = submission;
      }
      if (action === 'getReflectionPhoto') data = { dataUrl: 'data:image/png;base64,' + png.toString('base64') };
      if (action === 'getReflections') data = { questions, students: [{ email: 'sabado@example.com', name: 'Ana Exemplo', submission }, { email: 'outro@example.com', name: 'Outro aluno', submission: null }] };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', data }) });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:3011/sistema/');
    await page.evaluate(async () => {
      const { renderStudentReflection } = await import('/sistema/src/reflection.js');
      await renderStudentReflection(document.getElementById('app'), 'sabado@example.com');
    });
    assert.equal(await page.locator('[data-answer]').count(), 1);
    await page.locator('[data-answer]').fill(Array.from({ length: 5 }, (_, i) => `${i + 1}. Pode ou não pode fazer isso?`).join('\n'));
    await page.getByRole('button', { name: 'Enviar pergunta', exact: true }).click();
    await page.getByText('Reflexão enviada com sucesso', { exact: false }).waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].answers.length, 1);
    assert.equal(await page.locator('[data-answer]').first().inputValue(), writes[0].answers[0]);
    await page.screenshot({ path: 'artifacts/reflection-desktop.png', fullPage: true });
    await page.getByLabel('Anexar foto do manuscrito', { exact: true }).check();
    assert.equal(await page.locator('[data-answer]').first().isVisible(), false);
    assert.equal(await page.locator('ol li').count(), 0);
    await page.locator('[data-file]').setInputFiles({ name: 'manuscrito.png', mimeType: 'image/png', buffer: png });
    assert.equal(await page.locator('[data-preview] img').count(), 1);
    await page.getByRole('button', { name: 'Enviar nova versão', exact: true }).click();
    await page.getByText('Reflexão enviada com sucesso', { exact: false }).waitFor();
    assert.equal(writes.length, 2); assert.equal(writes[1].mode, 'photo');
    await page.getByRole('button', { name: 'Ver foto enviada', exact: true }).click();
    await page.locator('[data-photo] img').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/reflection-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(async () => {
      localStorage.setItem('tuig_role', 'master_admin');
      const { renderAdminDashboard } = await import('/sistema/src/admin.js');
      await renderAdminDashboard('admin@example.com');
    });
    await page.getByRole('button', { name: 'Reflexões de sábado', exact: true }).click();
    await page.getByText('1 de 2 alunos enviaram a atividade.').waitFor();
    await page.locator('#section-reflections summary').first().click();
    await page.getByRole('button', { name: 'Ver foto do manuscrito' }).click();
    await page.locator('#section-reflections img').waitFor();
    await page.getByRole('button', { name: 'Gestão de Alunos', exact: true }).click();
    assert.equal(await page.locator('#section-reflections').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('OK: quadro único para cinco perguntas, texto recuperado, foto com prévia, consulta pelo administrador, navegação e layout móvel; APIs reais bloqueadas.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
