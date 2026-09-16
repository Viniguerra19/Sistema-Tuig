const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const source = fs.readFileSync(require('node:path').join(__dirname, '../Code.gs'), 'utf8');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-09-05T15:00:00Z'])); }
  static now() { return new FixedDate().getTime(); }
}
function setup() {
  const tables = {
    'Usuários': [['Email', 'Nome', 'Role', 'Cursos', 'Áreas', 'Turma', '', '', 'Status', 'Data de ingresso'],
      ['admin@example.com', 'Admin', 'master_admin', '', '', '', '', '', 'Ativo', ''],
      ['ana@example.com', 'Ana', 'aluno', 'Curso', '', 'Sexta', '', '', 'Ativo', '2026-08-01'],
      ['bia@example.com', 'Bia', 'aluno', 'Curso', '', 'Sábado', '', '', 'Ativo', '2026-08-01']],
    'Agenda': [['Data', 'Evento', 'Turma'], ['2026-08-28', 'Gira', 'sexta'], ['2026-08-29', 'Gira', 'sábado'], ['2026-09-05', 'Hoje', 'ambos'], ['2026-09-06', 'Futuro', 'ambos']],
    'Presenças': [['Data', 'Email', 'Nome', 'Registrado por', '', 'Dispositivo']],
    'Justificativas': [['Data', 'Email', 'Nome', 'Motivo', 'Status']],
    'Mensalidades': [['Data', 'Email', 'Nome', 'Mês', 'Ano', 'Link', 'ID', 'Status']],
    'WhatsApp Usuários': [['Email', 'Nome', 'Telefone', 'LID', 'Consentimento', 'Status'],
      ['ana@example.com', 'Ana', '+55 (67) 98473-2686', '', 'Sim', 'Ativo'],
      ['bia@example.com', 'Bia', '+34 612 345 678', '', 'Sim', 'Ativo']]
  };
  const ss = {
    getSpreadsheetTimeZone: () => 'America/Sao_Paulo',
    getSheetByName(name) {
      return tables[name] ? { getDataRange: () => ({ getValues: () => tables[name] }), getRange: () => ({ setNumberFormat() {} }), getMaxRows: () => 1000, insertRowsAfter() {}, appendRow: row => tables[name].push(row), setFrozenRows() {} } : null;
    },
    insertSheet(name) { tables[name] = []; return this.getSheetByName(name); }
  };
  const ctx = vm.createContext({ Date: FixedDate, console, SpreadsheetApp: { openById: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => crypto.randomUUID(),
      formatDate: date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
  });
  vm.runInContext(source, ctx);
  const users = [{ email: 'ana@example.com', nome: 'Ana', turma: 'Sexta' }, { email: 'bia@example.com', nome: 'Bia', turma: 'Sábado' }];
  const params = { from: '2026-08-01', to: '2026-09-06', month: '2026-08' };
  const read = () => ctx.fuBuildData(ss, users, params, true);
  return { ctx, tables, params, ss, users, read };
}
test('backend compila; eventos hoje/futuros e turmas alheias não viram faltas', () => {
  const s = setup(), cases = s.read().cases;
  assert.equal(cases.filter(c => c.topic === 'presenca').length, 2);
  assert.ok(!cases.some(c => c.reference >= '2026-09-05'));
  assert.equal(cases.find(c => c.email === 'ana@example.com').reference, '2026-08-28');
});
test('aceita DDD 67 e Espanha, sem inventar DDI ou usar LID como telefone', () => {
  const s = setup(), cases = s.read().cases;
  assert.equal(cases.find(c => c.email === 'ana@example.com').phone, '5567984732686');
  assert.equal(cases.find(c => c.email === 'bia@example.com').phone, '34612345678');
});
test('presenças duplicadas e justificativas aprovadas/pendentes excluem lembrete', () => {
  const s = setup();
  s.tables['Presenças'].push(['2026-08-28', 'ana@example.com'], ['2026-08-28', 'ana@example.com']);
  s.tables['Justificativas'].push(['29/08/2026', 'bia@example.com', '', '', 'Pendente']);
  assert.equal(s.read().cases.filter(c => c.topic === 'presenca').length, 0);
  s.tables['Justificativas'][1][4] = 'Aprovado';
  assert.equal(s.read().cases.filter(c => c.topic === 'presenca').length, 0);
});
test('pagamentos por mês por extenso, numérico, aprovado, pendente e isenção', () => {
  const s = setup();
  s.tables['Mensalidades'].push(['', 'ana@example.com', '', 'Agosto', 2026, '', '', 'Aprovado']);
  s.tables['Mensalidades'].push(['', 'bia@example.com', '', 8, 2026, '', '', 'Pendente']);
  assert.equal(s.read().cases.filter(c => c.topic === 'mensalidade').length, 0);
  s.tables['Mensalidades'][2][7] = 'Isento';
  assert.equal(s.read().cases.filter(c => c.topic === 'mensalidade').length, 0);
});
test('data de ingresso protege períodos anteriores; datas inválidas e mês aberto são rejeitados', () => {
  const s = setup();
  s.tables['Usuários'][1 + 1][9] = '2026-09-01';
  assert.ok(!s.read().cases.some(c => c.email === 'ana@example.com'));
  assert.equal(s.ctx.fuDay('2026-02-31', 'UTC'), '');
  s.params.month = '2026-09'; assert.throws(s.read, /encerrado/);
});
test('números ambíguos, compartilhados ou bloqueados não abrem conversa', () => {
  const s = setup();
  s.tables['WhatsApp Usuários'].push(['ana@example.com', '', '5511999990000', '', '', 'Ativo']);
  assert.equal(s.read().cases.find(c => c.email === 'ana@example.com').phone, '');
  s.tables['WhatsApp Usuários'][2][5] = 'Bloqueado';
  assert.equal(s.read().cases.find(c => c.email === 'bia@example.com').phone, '');
  s.tables['WhatsApp Usuários'].pop();
  s.tables['WhatsApp Usuários'].push(['externo@example.com', '', '5567984732686', '', '', 'Ativo']);
  assert.equal(s.read().cases.find(c => c.email === 'ana@example.com').phone, '');
});
test('falta de planilha não gera lista falsa de inadimplentes', () => {
  const s = setup(); delete s.tables['Mensalidades']; assert.throws(s.read, /Não é seguro/);
});
test('histórico filtra usuários fora do acesso e administradores não veem financeiro na central', () => {
  const s = setup();
  s.tables.Acompanhamento = [['ID'], ['id', new FixedDate(), 'externo@example.com', 'Fora', 'mensalidade', '2026-08', 'contato', 'Resolvido']];
  assert.equal(s.read().history.length, 0);
  assert.ok(!s.ctx.fuBuildData(s.ss, s.users, s.params, false).cases.some(c => c.topic === 'mensalidade'));
});
test('a central abre direto para administrador, mas bloqueia quem não é administrador', () => {
  const s = setup();
  assert.ok(s.ctx.fuGetData({ ...s.params, adminEmail: 'admin@example.com' }).cases.length);
  assert.throws(() => s.ctx.fuGetData({ ...s.params, adminEmail: 'ana@example.com' }), /restrito/);
});
test('permissão é reavaliada a cada leitura', () => {
  const s = setup();
  assert.ok(s.ctx.fuGetData({ ...s.params, adminEmail: 'admin@example.com' }).cases.length);
  s.tables['Usuários'][1][8] = 'Inativo';
  assert.throws(() => s.ctx.fuGetData({ ...s.params, adminEmail: 'admin@example.com' }), /restrito/);
});
test('salva com confirmação, idempotência, autor administrador e histórico separado de situação', () => {
  const s = setup();
  const payload = { adminEmail: 'admin@example.com', id: crypto.randomUUID(), email: 'ana@example.com', topic: 'mensalidade', reference: '2026-08',
    type: 'contato', status: 'Aguardando resposta', message: '=Mensagem', notes: '+Observação', phone: '5567984732686', confirmed: false };
  assert.throws(() => s.ctx.fuSaveEvent(payload), /Confirme/);
  payload.confirmed = true;
  s.ctx.fuSaveEvent(payload); s.ctx.fuSaveEvent(payload);
  assert.throws(() => s.ctx.fuSaveEvent({ ...payload, notes: 'Outro texto' }), /outros dados/);
  assert.equal(s.tables.Acompanhamento.length, 2);
  assert.equal(s.tables.Acompanhamento[1][9], 'admin@example.com');
  assert.equal(s.tables.Acompanhamento[1][10], "'=Mensagem");
  payload.id = crypto.randomUUID(); payload.type = 'atualizacao'; payload.status = 'Resolvido';
  s.ctx.fuSaveEvent(payload);
  assert.equal(s.tables.Acompanhamento[2][10], '');
  const item = s.read().cases.find(c => c.email === 'ana@example.com' && c.topic === 'mensalidade');
  assert.equal(item.status, 'Resolvido'); assert.equal(item.lastContact.type, 'contato');
  payload.email = 'fora@example.com'; assert.throws(() => s.ctx.fuSaveEvent(payload), /fora/);
});
test('retomar exige data válida e planilha de outro formato não é sobrescrita', () => {
  const s = setup();
  const payload = { adminEmail: 'admin@example.com', id: crypto.randomUUID(), email: 'ana@example.com', topic: 'presenca', reference: '2026-08-28', type: 'atualizacao', status: 'Retomar', nextDate: '2026-09-04' };
  assert.throws(() => s.ctx.fuSaveEvent(payload), /futura/);
  payload.nextDate = '2026-09-06'; s.tables.Acompanhamento = [['Dados antigos']];
  assert.throws(() => s.ctx.fuSaveEvent(payload), /outro formato/);
  assert.equal(s.tables.Acompanhamento.length, 1);
});
