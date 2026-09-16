const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Today extends Date {
  constructor(...args) { super(...(args.length ? args : [2026, 8, 13, 12])); }
}
function setup() {
  const tables = {
    'Usuários': [['Email', 'Nome', 'Role', 'Cursos', 'Áreas', 'Turma'],
      ['fri@test.com', 'Sexta', 'aluno', '', '', 'sexta'],
      ['sat@test.com', 'Sábado', 'aluno', '', '', 'Sábado'],
      ['sun@test.com', 'Domingo', 'aluno', '', '', 'domingo']],
    'Rituais': [['Email', 'Ritual', 'Data']],
    'Agenda': [['Data', 'Evento', 'Turma'], [new Today(2026, 8, 11, 12), 'Gira', 'sexta'],
      [new Today(2026, 8, 12, 12), 'Gira', 'sábado'], [new Today(2026, 8, 13, 12), 'Gira', 'domingo']],
    'Presenças': [['Data', 'Email', 'Nome', 'Autor', 'GPS', 'Dispositivo']],
    'Justificativas': [['Data', 'Email', 'Nome', 'Motivo', 'Status']],
    'Mensalidades': [['Data', 'Email', 'Nome', 'Mês', 'Ano', 'Link', 'ID', 'Status']]
  };
  const reads = {}, writes = [], locks = [];
  const ss = { getSheetByName(name) { return !tables[name] ? null : {
    getDataRange: () => ({ getValues() { reads[name] = (reads[name] || 0) + 1; return tables[name].map(row => [...row]); } }),
    getLastRow: () => tables[name].length, getMaxRows: () => 1000,
    getRange: (row, col, count, width) => ({ setValues(values) {
      assert.equal(values.length, count); assert.equal(values[0].length, width);
      writes.push({ name, row, count });
      values.forEach((value, i) => { tables[name][row - 1 + i] = value; });
    } }), appendRow: row => tables[name].push(row)
  }; } };
  const ctx = vm.createContext({ Date: Today, console, SpreadsheetApp: { openById: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() { locks.push('start'); }, releaseLock() { locks.push('end'); } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) }
  });
  vm.runInContext(fs.readFileSync('Code.gs', 'utf8'), ctx);
  return { ctx, tables, reads, writes, locks };
}
test('domingo isolado; sábado acentuado; ambos e geral incluem domingo', () => {
  const { ctx } = setup();
  assert.equal(ctx.tuigEventApplies('domingo', 'sexta'), false);
  assert.equal(ctx.tuigEventApplies('domingo', 'domingo'), true);
  assert.equal(ctx.tuigEventApplies('Sábado', 'sabado'), true);
  assert.equal(ctx.tuigEventApplies('ambos', 'domingo'), true);
  assert.equal(ctx.tuigEventApplies('geral', 'domingo'), true);
});
test('ficha lê Agenda e Presenças uma vez e só inclui eventos da turma', () => {
  const { ctx, reads } = setup();
  const data = ctx.getUserData('sun@test.com');
  assert.equal(data.eventHistory.length, 1);
  assert.equal(reads.Agenda, 1);
  assert.equal(reads['Presenças'], 1);
  assert.equal(data.canMarkPresence, false);
});
test('dashboard separa domingo e não conta presenças duplicadas nem de outra turma', () => {
  const { ctx, tables } = setup();
  tables['Presenças'].push([new Today(2026, 8, 13, 12), 'sun@test.com'],
    [new Today(2026, 8, 13, 12), 'sun@test.com'], [new Today(2026, 8, 13, 12), 'sat@test.com']);
  const data = ctx.getDashboardStats();
  assert.equal(data.barChart.domingo, 100);
  assert.equal(data.barChart.sabado, 0);
  assert.equal(data.barChart.sexta, 0);
  const sunday = data.ranking.assiduos.find(row => row.nome === 'Domingo');
  assert.equal(sunday.esperados, 1); assert.equal(sunday.presencas, 1); assert.equal(sunday.faltas, 0);
});
test('chamada em massa usa uma gravação, bloqueio e evita repetir alunos', () => {
  const { ctx, tables, writes, locks } = setup();
  const data = { date: '2026-09-13', adminEmail: 'admin@test.com', presences: [
    { email: 'sun@test.com', nome: 'Domingo', isPresent: true },
    { email: 'sun@test.com', nome: 'Domingo', isPresent: true },
    { email: 'sat@test.com', nome: 'Sábado', isPresent: true }] };
  assert.equal(ctx.handleSaveBulkPresence(data).status, 'success');
  assert.equal(ctx.handleSaveBulkPresence(data).status, 'success');
  assert.equal(tables['Presenças'].length, 3); assert.equal(writes.length, 1);
  assert.deepEqual(locks, ['start', 'end', 'start', 'end']);
});
test('horário de domingo respeita início/fim e não libera sábado', () => {
  const { ctx } = setup();
  assert.equal(ctx.tuigSundayWindow(new Today(2026, 8, 13, 9, 59)), false);
  assert.equal(ctx.tuigSundayWindow(new Today(2026, 8, 13, 10)), true);
  assert.equal(ctx.tuigSundayWindow(new Today(2026, 8, 13, 11, 59)), true);
  assert.equal(ctx.tuigSundayWindow(new Today(2026, 8, 13, 12)), false);
  assert.equal(ctx.tuigSundayWindow(new Today(2026, 8, 12, 12)), false);
});
test('aulas noturnas abrem às 18h, seguem até 02:59 e fecham às 3h sem liberar outra turma', () => {
  const { ctx } = setup();
  for (const [day, group] of [[11, 'sexta'], [12, 'sábado']]) {
    for (const [offset, hour, minute, expected] of [[0,17,59,false], [0,18,0,true], [1,2,59,true], [1,3,0,false]]) {
      assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,day+offset,hour,minute), group, []).allowed, expected);
    }
  }
  assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,11,19), 'domingo', []).allowed, false);
});
test('gira ambos libera três turmas, usa data anterior de madrugada e substitui janela diurna', () => {
  const { ctx } = setup();
  const agenda = [['Data','Evento','Turma'], [new Today(2026,8,13,12), 'Gira', 'ambos']];
  for (const group of ['sexta','sábado','domingo']) {
    assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,13,10),group,agenda).allowed, false);
    assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,13,18),group,agenda).allowed, true);
    assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,14,2,59),group,agenda).allowed, true);
    assert.equal(ctx.tuigPresenceAvailability(new Today(2026,8,14,3),group,agenda).allowed, false);
  }
  assert.equal(ctx.getAdjustedDate(new Today(2026,8,14,2,59)).getDate(),13);
  assert.equal(ctx.getAdjustedDate(new Today(2026,8,14,3)).getDate(),14);
});
test('chamada por médium grava várias datas uma vez e não duplica repetição', () => {
  const { ctx, tables, writes } = setup();
  const data = { mediumEmail: 'sun@test.com', adminEmail: 'admin@test.com', presences: [
    { isoDate: '2026-09-06' }, { isoDate: '2026-09-13' }, { isoDate: '2026-09-13' }] };
  assert.equal(ctx.handleSaveBulkPresenceByMedium(data).status, 'success');
  assert.equal(ctx.handleSaveBulkPresenceByMedium(data).status, 'success');
  assert.equal(tables['Presenças'].length, 3); assert.equal(writes.length, 1);
});
test('domingo continua sem acesso à atividade exclusiva de sábado', () => {
  const { ctx } = setup();
  assert.throws(() => ctx.reflectionGet({ email: 'sun@test.com' }), /somente/);
});
