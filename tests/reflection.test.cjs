const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('Code.gs', 'utf8');
function setup() {
  const tables = { 'Usuários': [['Email', 'Nome', 'Role', 'Cursos', 'Áreas', 'Turma', '', '', 'Status'],
    ['sabado@example.com', 'Pessoa sábado', 'aluno', 'Curso', '', 'Sábado', '', '', 'Ativo'],
    ['sexta@example.com', 'Pessoa sexta', 'aluno', 'Curso', '', 'Sexta', '', '', 'Ativo'],
    ['admin@example.com', 'Administrador', 'master_admin', '', '', '', '', '', 'Ativo'],
    ['outro@example.com', 'Outra pessoa', 'aluno', 'Outro curso', '', 'Sábado', '', '', 'Ativo'],
    ['responsavel@example.com', 'Responsável', 'admin', '', 'Curso', '', '', '', 'Ativo']] };
  const files = new Map(), properties = new Map();
  const sheet = name => tables[name] ? { getDataRange: () => ({ getValues: () => tables[name] }), appendRow: row => tables[name].push(row), setFrozenRows() {} } : null;
  const ss = { getSheetByName: sheet, insertSheet(name) { tables[name] = []; return sheet(name); } };
  const folder = { getId: () => 'folder', createFile(blob) { const id = 'file-' + files.size; files.set(id, blob); return { getId: () => id }; } };
  const ctx = vm.createContext({ Date, console,
    SpreadsheetApp: { openById: () => ss }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties.get(k), setProperty: (k, v) => properties.set(k, v) }) },
    DriveApp: { createFolder: () => folder, getFolderById: () => folder, getFileById: id => ({ getBlob: () => files.get(id) }) },
    Utilities: { base64Decode: s => [...Buffer.from(s, 'base64')], base64Encode: bytes => Buffer.from(bytes).toString('base64'),
      newBlob: (bytes, type) => ({ getBytes: () => bytes, getContentType: () => type }) }
  });
  vm.runInContext(source, ctx);
  return { ctx, tables, files };
}
const base = () => ({ email: 'sabado@example.com', id: 'submission-123456789', mode: 'text', answers: [Array.from({ length: 5 }, (_, i) => `${i + 1}. Pode ou não pode fazer isso?`).join('\n')] });
test('reflexão: somente sábado ativo consulta e entrega; turma recebida do cliente não libera sexta', () => {
  const { ctx, tables } = setup();
  assert.equal(ctx.reflectionGet({ email: 'sabado@example.com' }).questions.length, 1);
  assert.throws(() => ctx.reflectionSave({ ...base(), email: 'sexta@example.com', turma: 'Sábado' }), /somente/);
  tables['Usuários'][1][8] = 'Inativo';
  assert.throws(() => ctx.reflectionSave(base()), /somente/);
});
test('reflexão digitada: valida quadro único, salva, recupera, permite nova versão e deduplica repetição', () => {
  const { ctx, tables } = setup();
  assert.throws(() => ctx.reflectionSave({ ...base(), answers: Array(10).fill('Resposta antiga') }), /único quadro/);
  assert.throws(() => ctx.reflectionSave({ ...base(), answers: [' '] }), /Preencha/);
  assert.throws(() => ctx.reflectionSave({ ...base(), answers: ['x'.repeat(5001)] }), /5000/);
  ctx.reflectionSave(base()); ctx.reflectionSave(base());
  assert.equal(tables['Reflexões Sábado'].length, 2);
  ctx.reflectionSave({ ...base(), id: 'submission-987654321', answers: ['Nova reflexão'] });
  assert.equal(ctx.reflectionGet({ email: base().email }).submission.answers[0], 'Nova reflexão');
  assert.equal(ctx.reflectionGet({ email: 'outro@example.com' }).submission, null);
});
test('foto: arquivo válido é guardado e somente aluno correspondente ou administrador autorizado consegue consultá-lo', () => {
  const { ctx, files } = setup();
  const photo = 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64');
  const saved = ctx.reflectionSave({ ...base(), mode: 'photo', photo });
  assert.equal(saved.hasPhoto, true); assert.equal(files.size, 1);
  assert.equal(ctx.reflectionPhoto({ email: base().email, id: saved.id }).dataUrl, photo);
  assert.equal(ctx.reflectionPhoto({ adminEmail: 'admin@example.com', id: saved.id }).dataUrl, photo);
  assert.throws(() => ctx.reflectionPhoto({ email: 'outro@example.com', id: saved.id }), /não encontrada/);
  assert.throws(() => ctx.reflectionPhoto({ adminEmail: 'outro@example.com', id: saved.id }), /restrito/);
});
test('foto inválida, tamanho excessivo e formato incorreto são recusados antes da gravação', () => {
  const { ctx, files } = setup();
  for (const photo of ['data:image/png;base64,aGVsbG8=', 'data:application/pdf;base64,aGVsbG8=', 'data:image/jpeg;base64,' + 'A'.repeat(5600001)]) {
    assert.throws(() => ctx.reflectionSave({ ...base(), mode: 'photo', photo }), /foto/);
  }
  assert.equal(files.size, 0);
});
test('admin vê entregas e pendências somente das pessoas de sábado no seu escopo', () => {
  const { ctx } = setup(); ctx.reflectionSave(base());
  const all = ctx.reflectionList('admin@example.com').students;
  assert.equal(all.length, 2); assert.equal(all.filter(s => s.submission).length, 1);
  const scoped = ctx.reflectionList('responsavel@example.com').students;
  assert.equal(scoped.length, 1); assert.equal(scoped[0].email, base().email);
  assert.throws(() => ctx.reflectionList('sabado@example.com'), /restrito/);
});
