/**
 * Aniversários TUIG: cadastro único em Usuários!J (dia/mês).
 * Instalar no MESMO projeto Apps Script de Code.gs. Ver ANIVERSARIOS.md.
 * Nenhum envio ocorre ao migrar, visualizar ou abrir a planilha.
 */
const ANIV_COLUMN = 10;
const ANIV_GROUPS = ['sexta', 'sabado', 'domingo'];

function anivText(value) { return value == null ? '' : String(value).trim(); }
function anivNorm(value) { return anivText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' '); }

// O ano legado pode ser apenas o ano da comemoração. Nunca inferimos idade.
function anivDay(value, timezone) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    value = Utilities.formatDate(value, timezone, 'dd/MM');
  }
  const text = anivText(value);
  let match = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) {
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) match = [text, iso[3], iso[2], iso[1]];
  }
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : 2000;
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
  const limit = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31][month - 1];
  if (day > limit) return null;
  return String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0');
}

// "Ambos" fica pendente: com três turmas, não define quais dois grupos usar.
function anivGroups(value) {
  const parts = anivNorm(value).split(/\s*[,;/]\s*|\s+e\s+/).filter(Boolean);
  return parts.length && parts.every(p => ANIV_GROUPS.includes(p)) ? [...new Set(parts)] : [];
}

function anivRead() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(NOME_ABA_USUARIOS);
  if (!sheet) throw new Error('Aba Usuários não encontrada.');
  const rows = sheet.getDataRange().getValues();
  const header = anivNorm((rows[0] || [])[9]);
  if (header && !['aniversario', 'aniversarios', 'data de nascimento', 'nascimento'].includes(header)) {
    throw new Error('A coluna J tem outro cabeçalho. Nenhum dado foi alterado.');
  }
  const formulas = sheet.getDataRange().getFormulas();
  if ((formulas[0] || [])[9]) throw new Error('O cabeçalho J1 contém uma fórmula. Confira manualmente.');
  return { ss, sheet, rows, formulas, timezone: ss.getSpreadsheetTimeZone() };
}

function anivMigrationPlan(rows, sources, timezone, formulas) {
  const users = rows.slice(1).map((r, i) => ({ row: i + 2, email: anivNorm(r[0]), name: anivText(r[1]), group: anivText(r[5]), value: r[9], formula: (formulas[i + 1] || [])[9] || '' })).filter(u => u.name || u.email);
  const report = { preencher: [], preservados: [], pendencias: [], semData: [], avisos: [] };
  const byName = new Map(), byEmail = new Map(), grouped = new Map();
  users.forEach(u => {
    const name = anivNorm(u.name);
    byName.set(name, (byName.get(name) || []).concat(u));
    byEmail.set(u.email, (byEmail.get(u.email) || []).concat(u));
  });
  sources.forEach(source => {
    source.rows.slice(1).forEach((r, i) => {
      if (!anivText(r[0]) && !anivText(r[1])) return;
      const item = { origem: source.name + '!A' + (i + 2) + ':B' + (i + 2), nome: anivText(r[0]), data: anivDay(r[1], timezone), turma: anivNorm(source.name) };
      const key = anivNorm(r[0]);
      grouped.set(key, (grouped.get(key) || []).concat(item));
    });
  });
  grouped.forEach((items, name) => {
    const matches = byName.get(name) || [];
    const base = { nome: items[0].nome, origens: items.map(i => i.origem), datas: [...new Set(items.map(i => i.data || 'Data inválida/ausente'))], celulas: matches.map(u => 'J' + u.row) };
    let reason = '';
    if (!name || name.split(' ').length < 2) reason = 'Nome incompleto ou apelido: conferir manualmente.';
    else if (!matches.length) reason = 'Nenhum nome completo correspondente em Usuários.';
    else if (matches.length !== 1) reason = 'Mais de um usuário com esse nome.';
    else if (!matches[0].email || byEmail.get(matches[0].email).length !== 1) reason = 'E-mail ausente ou duplicado em Usuários.';
    else if (items.some(i => !i.data)) reason = 'Data ausente ou inválida na origem.';
    else if (base.datas.length !== 1) reason = 'Datas diferentes para o mesmo nome nas origens.';
    else if (!items.every(i => anivGroups(matches[0].group).includes(i.turma))) reason = 'Turma diferente ou ambígua: conferir a associação.';
    if (reason) { report.pendencias.push(Object.assign(base, { motivo: reason })); return; }
    const user = matches[0];
    if (user.formula || anivText(user.value)) {
      if (anivDay(user.value, timezone) === items[0].data) report.preservados.push({ nome: user.name, celula: 'J' + user.row, data: items[0].data });
      else report.pendencias.push(Object.assign(base, { motivo: 'J já contém valor ou fórmula diferente. Não sobrescrito.' }));
      return;
    }
    report.preencher.push({ row: user.row, celula: 'J' + user.row, nome: user.name, email: user.email, data: items[0].data, origens: base.origens });
  });
  const planned = new Set(report.preencher.map(p => p.row));
  users.forEach(u => {
    if (!anivDay(u.value, timezone) && !planned.has(u.row)) report.semData.push({ nome: u.name, celula: 'J' + u.row, turma: u.group, motivo: anivText(u.value) || u.formula ? 'Data inválida ou fórmula sem data.' : 'Data ainda não preenchida.' });
  });
  return report;
}

function anivMigrate(write) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ctx = anivRead(), sources = [], missing = [];
    ANIV_GROUPS.forEach(name => {
      const matches = ctx.ss.getSheets().filter(s => anivNorm(s.getName()) === name);
      if (matches.length > 1) throw new Error('Mais de uma aba corresponde à turma ' + name + '. Confira os nomes.');
      if (!matches.length) { missing.push(name); return; }
      const rows = matches[0].getDataRange().getValues(), header = rows[0] || [];
      if (!['nome', 'nome completo'].includes(anivNorm(header[0])) ||
          !['data', 'data de aniversario', 'data de nascimento', 'aniversario', 'nascimento'].includes(anivNorm(header[1]))) {
        throw new Error('Confira as colunas A (nome) e B (aniversário) da aba ' + matches[0].getName() + '. Nenhum dado foi alterado.');
      }
      sources.push({ name: matches[0].getName(), rows });
    });
    const report = anivMigrationPlan(ctx.rows, sources, ctx.timezone, ctx.formulas);
    report.avisos = missing.map(name => 'Aba de origem não encontrada: ' + name + '.');
    report.aplicado = write;
    if (write) {
      if (!anivText((ctx.rows[0] || [])[9])) ctx.sheet.getRange(1, ANIV_COLUMN).setValue('Aniversario');
      report.preencher.forEach(item => {
        const cell = ctx.sheet.getRange(item.row, ANIV_COLUMN);
        // Reconfere para não sobrescrever uma edição manual após a leitura inicial.
        const identity = ctx.sheet.getRange(item.row, 1, 1, 6).getValues()[0];
        if (anivNorm(identity[0]) !== item.email || anivText(identity[1]) !== item.nome || cell.getFormula() || anivText(cell.getValue())) {
          throw new Error('A linha ' + item.row + ' mudou durante a migração. Execute novamente para continuar; dados anteriores foram preservados.');
        }
        cell.setNumberFormat('@').setValue(item.data);
      });
    }
    Logger.log(JSON.stringify(report));
    return report;
  } finally { lock.releaseLock(); }
}

function simularMigracaoAniversarios() { return anivMigrate(false); }
function migrarAniversariosParaUsuarios() { return anivMigrate(true); }

function anivTodayPlan(rows, timezone, now) {
  const today = Utilities.formatDate(now, timezone, 'dd/MM');
  const emails = new Map();
  rows.slice(1).forEach(r => { const email = anivNorm(r[0]); emails.set(email, (emails.get(email) || 0) + 1); });
  const result = { data: Utilities.formatDate(now, timezone, 'yyyy-MM-dd'), aniversariantes: [], pendencias: [] };
  rows.slice(1).forEach((r, i) => {
    if (!anivText(r[0]) && !anivText(r[1])) return;
    if (memberInactive(r[8])) return;
    const date = anivDay(r[9], timezone), email = anivNorm(r[0]), groups = anivGroups(r[5]);
    let reason = '';
    if (!date) reason = anivText(r[9]) ? 'Data inválida.' : 'Aniversário não preenchido.';
    else if (!email || emails.get(email) !== 1 || !anivText(r[1])) reason = 'Cadastro sem nome/e-mail único.';
    else if (!groups.length) reason = 'Turma ambígua. Use Sexta, Sábado, Domingo ou uma lista explícita.';
    if (reason) { result.pendencias.push({ nome: anivText(r[1]), celula: 'J' + (i + 2), motivo: reason }); return; }
    if (date === today) result.aniversariantes.push({ email, nome: anivText(r[1]), turmas: groups });
  });
  return result;
}

function visualizarAniversariosHoje() {
  const ctx = anivRead();
  const plan = anivTodayPlan(ctx.rows, ctx.timezone, new Date());
  Logger.log(JSON.stringify(plan));
  return plan;
}

function anivConfig() {
  const p = PropertiesService.getScriptProperties();
  const groups = {};
  ANIV_GROUPS.forEach(g => { groups[g] = anivText(p.getProperty('ANIVERSARIOS_GRUPO_' + g.toUpperCase())); });
  return { enabled: p.getProperty('ANIVERSARIOS_ATIVO') === 'SIM',
    instance: anivText(p.getProperty('ANIVERSARIOS_WAPI_INSTANCE_ID') || p.getProperty('WAPI_INSTANCE_ID')),
    token: anivText(p.getProperty('ANIVERSARIOS_WAPI_TOKEN') || p.getProperty('WAPI_TOKEN')),
    // Mesmo destino pessoal do sistema antigo. Pode ser alterado nas Propriedades do script.
    personal: anivText(p.getProperty('ANIVERSARIOS_AVISO_TELEFONE') || '5511934615897'), groups };
}

function anivValidateConfig(config) {
  if (!config.instance || !config.token) throw new Error('Informe WAPI_INSTANCE_ID e WAPI_TOKEN nas Propriedades do script (ou ANIVERSARIOS_WAPI_INSTANCE_ID e ANIVERSARIOS_WAPI_TOKEN se usar outra instância).');
  if (config.personal && !/^\d{10,15}$/.test(config.personal)) throw new Error('ANIVERSARIOS_AVISO_TELEFONE deve conter apenas país, DDD e número.');
  if (!config.personal && !Object.values(config.groups).some(Boolean)) throw new Error('Configure pelo menos um destino dos aniversários.');
  Object.keys(config.groups).forEach(group => {
    if (config.groups[group] && !/^[\d-]+@g\.us$/.test(config.groups[group])) throw new Error('ID inválido no grupo de ' + group + '.');
  });
}

function anivMessage(name) {
  return `Bom dia, Bença Mãe,Paizinho! Axé meus irmãos!

Hoje o Terreiro se enche de luz para celebrar a vida de *${name}*! Cada passo seu é uma bênção, cada gesto seu é um reflexo da força que nos une.

Que as ventanias de Iansã levem embora tudo o que te impede, que Ogum abra teus caminhos, que os Exus te protejam e os Pretos Velhos te aconselhem com sabedoria.

Você é parte essencial desta corrente. Sua presença é motivo de alegria e gratidão.

Feliz novo ciclo! Estamos com você — de coração aberto, com fé, amor e axé.
🎉🎂🎊`;
}

// Canal dedicado: não relaxa a restrição do bot de responder apenas ao remetente.
function anivSend(config, destination, message) {
  const response = UrlFetchApp.fetch('https://api.w-api.app/v1/message/send-text?instanceId=' + encodeURIComponent(config.instance), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + config.token }, payload: JSON.stringify({ phone: destination, message })
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('W-API retornou HTTP ' + code + '. Confira o provedor antes de repetir.');
  let body;
  try { body = JSON.parse(response.getContentText()); } catch (e) { throw new Error('Resposta não confirmada pela W-API. Confira o provedor antes de repetir.'); }
  if (!body || body.error || body.success === false || ['error','failed'].includes(String(body.status).toLowerCase())) {
    throw new Error('A W-API não confirmou o envio. Confira o provedor antes de repetir.');
  }
}

function verificarAniversariosTuig() {
  const config = anivConfig();
  if (!config.enabled) return { ativo: false, mensagem: 'Rotina desativada. Prévia e migração continuam disponíveis.' };
  anivValidateConfig(config);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ctx = anivRead(), plan = anivTodayPlan(ctx.rows, ctx.timezone, new Date());
    const props = PropertiesService.getScriptProperties();
    const result = { data: plan.data, aceitos: 0, ignorados: 0, pendencias: plan.pendencias.slice(), falhas: [] };
    plan.aniversariantes.forEach(person => {
      const message = anivMessage(person.nome), destinations = new Map();
      if (config.personal) destinations.set(config.personal, '🎉 *TEM ANIVERSÁRIO HOJE!* 🎂\n\n*Aniversariante:* ' + person.nome + '\n*Turma:* ' + person.turmas.join(', ') + '\n\n' + message);
      person.turmas.forEach(group => {
        if (config.groups[group]) destinations.set(config.groups[group], message);
      });
      destinations.forEach((text, destination) => {
        const key = 'ANIV_ENVIO_' + memberHash(person.email + '|' + destination);
        const previous = props.getProperty(key) || '';
        if (previous.split('|')[0] === plan.data) {
          result.ignorados++;
          if (previous !== plan.data + '|aceito') result.falhas.push({ nome: person.nome, destino: destination, chave: key, motivo: 'Tentativa anterior sem confirmação. Conferir no provedor; não reenviada automaticamente.' });
          return;
        }
        // Reserva ANTES da chamada. Timeout/queda não pode provocar disparo duplicado.
        props.setProperty(key, plan.data + '|pendente');
        try {
          anivSend(config, destination, text);
          props.setProperty(key, plan.data + '|aceito');
          result.aceitos++;
        } catch (e) {
          result.falhas.push({ nome: person.nome, destino: destination, chave: key, motivo: 'Envio sem confirmação. Confira o provedor antes de qualquer reenvio.' });
        }
      });
    });
    Logger.log(JSON.stringify(result));
    // Faz o gatilho sinalizar falha ao responsável, sem reenviar destinos já tentados.
    if (result.falhas.length) {
      throw new Error('Aniversários: há envios a conferir. Consulte o relatório no registro desta execução.');
    }
    return result;
  } finally { lock.releaseLock(); }
}

function configurarGatilhoAniversariosTuig() {
  const config = anivConfig();
  anivValidateConfig(config);
  const ctx = anivRead();
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.some(t => t.getHandlerFunction() === 'verificarAniversarios')) {
    throw new Error('Desative o gatilho antigo verificarAniversarios antes de ativar o novo.');
  }
  if (!triggers.some(t => t.getHandlerFunction() === 'verificarAniversariosTuig')) {
    ScriptApp.newTrigger('verificarAniversariosTuig').timeBased().atHour(8).everyDays(1).inTimezone(ctx.timezone).create();
  }
  PropertiesService.getScriptProperties().setProperty('ANIVERSARIOS_ATIVO', 'SIM');
  const result = 'Aviso diário ativado para a faixa das 8h no fuso da planilha. Nenhuma mensagem foi enviada agora.';
  Logger.log(result);
  return result;
}

function pausarAniversariosTuig() {
  PropertiesService.getScriptProperties().setProperty('ANIVERSARIOS_ATIVO', 'NAO');
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'verificarAniversariosTuig').forEach(t => ScriptApp.deleteTrigger(t));
  const result = 'Aviso diário pausado e gatilho removido.';
  Logger.log(result);
  return result;
}

function anivShowReport(report, title) {
  const escape = value => anivText(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const table = (label, items, columns) => '<h3>' + escape(label) + ' (' + items.length + ')</h3>' + (items.length ?
    '<table><thead><tr>' + columns.map(c => '<th>' + escape(c[0]) + '</th>').join('') + '</tr></thead><tbody>' +
    items.map(item => '<tr>' + columns.map(c => '<td>' + escape(Array.isArray(item[c[1]]) ? item[c[1]].join(', ') : item[c[1]]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : '<p>Nenhum registro.</p>');
  let body = '';
  if (report.preencher) {
    body += table(report.aplicado ? 'Datas preenchidas' : 'Datas que podem ser preenchidas', report.preencher, [['Nome','nome'],['Célula em Usuários','celula'],['Dia/mês','data']]);
    body += table('Datas existentes preservadas', report.preservados, [['Nome','nome'],['Célula','celula'],['Dia/mês','data']]);
    body += table('Origens que precisam de conferência manual', report.pendencias, [['Nome na origem','nome'],['Origem','origens'],['Dia/mês','datas'],['Possível célula','celulas'],['Motivo','motivo']]);
    body += table('Cadastros ainda sem data válida', report.semData, [['Nome','nome'],['Célula em Usuários','celula'],['Turma','turma'],['Motivo','motivo']]);
    body += (report.avisos || []).map(a => '<p>' + escape(a) + '</p>').join('');
  } else {
    body += '<p>Data: ' + escape(report.data) + '</p>';
    body += table('Aniversariantes ativos de hoje', report.aniversariantes, [['Nome','nome'],['Turmas','turmas']]);
    body += table('Cadastros a conferir', report.pendencias, [['Nome','nome'],['Célula em Usuários','celula'],['Motivo','motivo']]);
  }
  const html = '<style>body{font:14px system-ui;padding:16px;color:#182638}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #dce1e6;padding:8px;text-align:left;overflow-wrap:anywhere}th{background:#edf2f7}h3{margin-top:28px}</style><h2>' + escape(title) + '</h2><p>Corrija as dúvidas diretamente em Usuários, coluna J. Use dia/mês, por exemplo 19/06. Nenhuma mensagem de WhatsApp é enviada por esta tela.</p>' + body;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(850).setHeight(600), title);
}
function mostrarPreviaMigracaoAniversarios() { anivShowReport(simularMigracaoAniversarios(), 'Prévia da migração de aniversários'); }
function preencherAniversariosSeguros() { anivShowReport(migrarAniversariosParaUsuarios(), 'Resultado do preenchimento de aniversários'); }
function mostrarAniversariosHoje() { anivShowReport(visualizarAniversariosHoje(), 'Aniversariantes de hoje e pendências'); }
