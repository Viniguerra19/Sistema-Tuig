const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const context = await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    const writes=[], errors=[];
    await context.route('**/*',async route => {
      const url = new URL(route.request().url());
      if(url.hostname==='127.0.0.1') return route.continue();
      if(!url.hostname.includes('script.google')) return route.abort();
      const body=route.request().postDataJSON(), action=body?.action || url.searchParams.get('action');
      if(body) writes.push(body);
      let data=[];
      if(action==='membershipList') data=[{email:'ana@example.com',name:'Ana Teste',turma:'sábado',status:'Ativo',notes:'Solicitado pelo titular'}];
      if(action==='membershipPreview') data={rows:4,files:1,sheets:[{name:'Usuários',count:1},{name:'Presenças',count:3}],issues:[],fingerprint:'test'};
      if(action==='membershipChallenge') data={id:'test-challenge'};
      if(action==='membershipConfirm') data={deleted:true};
      await route.fulfill({json:{status:'success',data}});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'EXCLUIR':undefined));
    await page.goto('http://127.0.0.1:3011/sistema/');
    assert.equal(await page.locator('#btn-membership-access').count(),0);
    assert.equal(await page.locator('[data-away], [data-delete]').count(),0);
    await page.evaluate(async()=>{
      localStorage.setItem('tuig_role','master_admin');localStorage.setItem('tuig_email','admin@example.com');
      const {renderAdminDashboard}=await import('/sistema/src/admin.js');
      await renderAdminDashboard('admin@example.com');
    });
    assert.equal(await page.getByText('Registrar Irmão',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Vínculos e saídas',exact:true}).click();
    await page.getByText('Ana Teste — Ativo',{exact:true}).click();
    await page.getByRole('button',{name:'Deletar todos os dados'}).click();
    await page.getByRole('button',{name:'Excluir definitivamente',exact:true}).click();
    await page.getByLabel('Código de confirmação').fill('123456');
    await page.getByRole('button',{name:'Confirmar operação'}).click();
    await page.getByText('Ana Teste — Ativo',{exact:true}).waitFor();
    assert.equal(writes.find(w=>w.action==='membershipConfirm').data.code,'123456');
    await page.evaluate(async()=>{
      const {renderMembershipSelf}=await import('/sistema/src/membership.js');
      renderMembershipSelf(document.getElementById('app'),'ana@example.com');
    });
    await page.locator('.membership-self > summary').click();
    await page.getByRole('button',{name:'Solicitar exclusão definitiva dos meus dados'}).click();
    await page.getByLabel('Código de confirmação').waitFor();
    assert.equal(writes.filter(w=>w.action==='membershipChallenge').at(-1).data.operation,'requestDeletion');
    for (const role of ['aluno', 'admin', 'master_admin']) {
      await page.evaluate(async role => {
        localStorage.setItem('tuig_role', role);
        const {renderStudentDashboard} = await import('/sistema/src/student.js');
        if (role === 'aluno') await renderStudentDashboard('ana@example.com');
        else {
          const {renderAdminDashboard} = await import('/sistema/src/admin.js');
          await renderAdminDashboard('ana@example.com');
          document.querySelector('[data-tab="student"]').click();
        }
      }, role);
      const card = page.locator('.membership-self');
      await card.waitFor();
      assert.equal(await card.locator('[data-away]').isVisible(), false);
      assert.equal(await card.locator('[data-delete]').isVisible(), false);
      await card.locator('summary').click();
      assert.equal(await card.locator('[data-away]').isVisible(), true);
      assert.equal(await card.locator('[data-delete]').isVisible(), true);
      await card.locator('summary').press('Enter');
      assert.equal(await card.locator('[data-away]').isVisible(), false);
      await card.locator('summary').press('Space');
      assert.equal(await card.locator('[data-away]').isVisible(), true);
      assert.equal(await page.locator('[data-membership-self]').count(), 1);
      if (role !== 'master_admin') {
        await card.locator('[data-away]').click();
        await card.getByLabel('Código de confirmação').waitFor();
        const request = writes.filter(w=>w.action==='membershipChallenge').at(-1).data;
        assert.equal(request.operation, 'away');
        assert.equal(request.email, 'ana@example.com');
        assert.equal(request.target, request.email);
      }
    }
    assert.deepEqual(errors,[]);
    console.log('OK: administração sem Registrar Irmão; conferência e confirmação de exclusão; pedido do aluno em tela móvel. APIs reais bloqueadas.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
