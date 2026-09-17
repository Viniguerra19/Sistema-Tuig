const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
function setup() {
  const tables = {
    'Usuários': [['Email','Nome','Role','Cursos','Áreas','Turma','','','Status'],
      ['admin@test.com','Admin','master_admin','','','','','','Ativo'],
      ['ana@test.com','Ana Teste','aluno','','','sábado','','','Ativo'],
      ['bia@test.com','Bia Teste','aluno','','','domingo','','','Ativo']],
    'WhatsApp Usuários': [['Email','Nome','Telefone','LID','Consentimento','Status'], ['ana@test.com','Ana Teste','5511999999999','123456789012345@lid','Sim','Ativo']],
    'Presenças': [['Data','Email','Nome'], [new Date(),'ana@test.com','Ana Teste'], [new Date(),'bia@test.com','Bia Teste']],
    'WhatsApp Sessões': [['Chave','Estado','Dados JSON'], ['LID:123456789012345@lid','IDLE','{}']],
    'Aniversários': [['Nome','Aniversário'], ['Ana Teste', '01/01'], ['Bia Teste','02/02']],
    'Reflexões Sábado': [['ID','Enviado em','Email','Nome','Formato','Respostas JSON','Foto ID'], ['submission-anatest',new Date(),'ana@test.com','Ana Teste','photo','[]','photo_1234567890']],
    'Histórico de vínculos': [['Email','Situação','Início','Fim','Responsável','Observação']]
  };
  const library = { 'Empréstimos': [['ID','LivroID','TítuloLivro','Email','Nome','Solicitação','Retirada','Prevista','Real','Status'], ['loan_1234567890','book','Livro','ana@test.com','Ana Teste','','','','','Devolvido']] };
  const props = new Map(), sent = [], deletedFiles = [];
  const makeBook = (id, data) => ({ getId: () => id, getSpreadsheetTimeZone: () => 'America/Sao_Paulo',
    getSheets() { return Object.keys(data).map(name => this.getSheetByName(name)); },
    insertSheet(name) { data[name] = []; return this.getSheetByName(name); },
    getSheetByName(name) { if (!data[name]) return null; return {
      getName: () => name, getDataRange: () => ({getValues: () => data[name].map(r => [...r])}),
      appendRow: row => data[name].push(row), deleteRow: index => data[name].splice(index-1,1),
      getRange: (r,c) => ({setValue: value => { data[name][r-1][c-1] = value; }})
    }; }
  });
  let mainId;
  const ctx = vm.createContext({ Date, console,
    SpreadsheetApp: { openById: id => makeBook(id, id === mainId ? tables : library) },
    PropertiesService: { getScriptProperties: () => ({getProperty: k => props.get(k), setProperty: (k,v) => props.set(k,v), deleteProperty: k => props.delete(k)}) },
    Utilities: {getUuid: () => crypto.randomUUID(), DigestAlgorithm: {SHA_256:'sha256'}, computeDigest: (_,text) => [...crypto.createHash('sha256').update(text).digest()]},
    LockService: {getScriptLock: () => ({ waitLock(){}, releaseLock(){} })},
    MailApp: {sendEmail: (...args) => sent.push(args)},
    ScriptApp: {getOAuthToken: () => 'mock'},
    UrlFetchApp: {fetch: (url,options) => {if(options.method === 'delete') {deletedFiles.push(url); return {getResponseCode: () => 204};} return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({mimeType:'image/png',capabilities:{canDelete:true}})};}},
    ContentService: {MimeType:{JSON:'JSON'}, createTextOutput:text => ({setMimeType:()=>JSON.parse(text)})}
  });
  vm.runInContext(fs.readFileSync('Code.gs','utf8') + '\n' + fs.readFileSync('WhatsApp.gs','utf8'), ctx);
  mainId = vm.runInContext('SPREADSHEET_ID',ctx);
  const confirm = data => { const challenge = ctx.memberChallenge(data); const code = sent.at(-1)[2].match(/Código: (\d+)/)[1]; return ctx.memberConfirm({...data,challenge:challenge.id,code}); };
  return { ctx, tables, library, props, sent, deletedFiles, confirm };
}
test('afasta e reativa preservando dados, excluindo o período do cálculo e bloqueando WhatsApp', () => {
  const {ctx,tables,confirm} = setup();
  confirm({email:'admin@test.com',target:'ana@test.com',operation:'away',notes:'Pausa'});
  assert.equal(tables['Usuários'][2][8],'Afastado');
  assert.equal(ctx.getUserRole('ana@test.com'),null);
  assert.equal(ctx.waGetUserRecordByEmail('ana@test.com'),null);
  assert.equal(ctx.waIsSenderListedInSheet({phone:'5511999999999',lid:'123456789012345@lid'}),false);
  assert.equal(tables['Presenças'].length,3);
  confirm({email:'admin@test.com',target:'ana@test.com',operation:'activate',notes:''});
  assert.equal(ctx.getUserRole('ana@test.com'),'aluno');
  assert.equal(tables['WhatsApp Usuários'][1][5],'Ativo');
  assert.ok(tables['Histórico de vínculos'][1][3] instanceof Date);
  const periods = {'ana@test.com':[{from:new Date(2026,7,1),to:new Date(2026,7,31)}]};
  assert.equal(ctx.memberExcluded(periods,'ana@test.com','2026-08-14',false),true);
  assert.equal(ctx.memberExcluded(periods,'ana@test.com','2026-08',true),true);
  assert.equal(ctx.memberExcluded(periods,'ana@test.com','2026-09-01',false),false);
});
test('pedido do titular exige código; código não pode ser reutilizado ou trocar a operação', () => {
  const {ctx,tables,sent} = setup();
  const data = {email:'ana@test.com',target:'ana@test.com',operation:'away'};
  const challenge = ctx.memberChallenge(data);
  assert.throws(() => ctx.memberConfirm({...data,challenge:challenge.id,code:'000000x'}),/incorreto/);
  assert.equal(tables['Usuários'][2][8],'Ativo');
  const code = sent[0][2].match(/Código: (\d+)/)[1];
  ctx.memberConfirm({...data,operation:'delete',challenge:challenge.id,code});
  assert.equal(tables['Usuários'][2][8],'Afastado');
  assert.throws(() => ctx.memberConfirm({...data,challenge:challenge.id,code}),/expirado/);
});
test('exclusão percorre abas, sessões, aniversário, outra planilha e anexos; preserva outra pessoa', () => {
  const {ctx,tables,library,confirm,deletedFiles} = setup();
  confirm({email:'ana@test.com',target:'ana@test.com',operation:'requestDeletion'});
  const plan = ctx.memberPreview({email:'admin@test.com',target:'ana@test.com'});
  assert.equal(plan.issues.length,0); assert.equal(plan.files,1);
  assert.ok(plan.sheets.some(s=>s.name==='Aniversários'));
  assert.ok(plan.sheets.some(s=>s.name==='WhatsApp Sessões'));
  confirm({email:'admin@test.com',target:'ana@test.com',operation:'delete',fingerprint:plan.fingerprint});
  assert.equal(ctx.getUserRole('ana@test.com'),null);
  assert.equal(ctx.getUserRole('bia@test.com'),'aluno');
  assert.equal(tables['Presenças'].length,2);
  assert.equal(tables['WhatsApp Sessões'].length,1);
  assert.equal(library['Empréstimos'].length,1);
  assert.equal(deletedFiles.length,1);
});
test('master pode excluir cadastro ativo sem pedido prévio do titular', () => {
  const {ctx,tables,confirm} = setup();
  const plan = ctx.memberPreview({email:'admin@test.com',target:'ana@test.com'});
  confirm({email:'admin@test.com',target:'ana@test.com',operation:'delete',fingerprint:plan.fingerprint});
  assert.equal(tables['Usuários'].some(r=>r[0]==='ana@test.com'),false);
  assert.equal(ctx.getUserRole('bia@test.com'),'aluno');
});
test('master não encerra o próprio acesso; outro master pode gerenciá-lo; desligar não existe', () => {
  const {ctx,tables} = setup();
  assert.throws(()=>ctx.memberAuthorize({email:'admin@test.com',target:'admin@test.com',operation:'away'}),/própria conta master/);
  tables['Usuários'][3][2]='master_admin';
  assert.doesNotThrow(()=>ctx.memberAuthorize({email:'bia@test.com',target:'admin@test.com',operation:'away'}));
  assert.throws(()=>ctx.memberAuthorize({email:'ana@test.com',target:'ana@test.com',operation:'leave'}));
});
test('homônimo sem e-mail e arquivo compartilhado bloqueiam exclusão', () => {
  const {ctx,tables} = setup();
  tables['Usuários'][3][1]='Ana Teste';
  assert.ok(ctx.memberDeletionPlan('ana@test.com').issues.some(i=>i.includes('ambíguo')));
  tables['Outra aba']=[['Email','Anexo'],['bia@test.com','photo_1234567890']];
  assert.ok(ctx.memberDeletionPlan('ana@test.com').issues.some(i=>i.includes('Anexo compartilhado')));
});
test('alteração após conferência ou falha no Drive não apaga linhas', () => {
  const {ctx,tables,confirm} = setup();
  confirm({email:'ana@test.com',target:'ana@test.com',operation:'requestDeletion'});
  const plan=ctx.memberDeletionPlan('ana@test.com');
  tables['Presenças'].push([new Date(),'ana@test.com','Ana Teste']);
  assert.throws(()=>ctx.memberDelete({email:'admin@test.com',target:'ana@test.com',operation:'delete',fingerprint:plan.fingerprint}),/mudaram/);
  ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>403});
  assert.throws(()=>ctx.memberDelete({email:'admin@test.com',target:'ana@test.com',operation:'delete',fingerprint:ctx.memberDeletionPlan('ana@test.com').fingerprint}),/anexo/);
  assert.equal(tables['Usuários'].length,4);
});
test('só titular pede exclusão; só master executa; endpoint bloqueia acesso inativo', () => {
  const {ctx,tables} = setup();
  assert.throws(()=>ctx.memberAuthorize({email:'admin@test.com',target:'ana@test.com',operation:'requestDeletion'}),/titular/);
  assert.throws(()=>ctx.memberPreview({email:'bia@test.com',target:'ana@test.com'}),/administração/);
  tables['Usuários'][2][8]='Afastado';
  const result=ctx.doGet({parameter:{action:'getCoursesData',email:'ana@test.com'}});
  assert.equal(result.status,'error'); assert.match(result.message,/inativo/);
});
test('IDs encadeados e JSON com nome são localizados em abas sem e-mail', () => {
  const {ctx,tables} = setup();
  tables['Dependências']=[['Referência','Detalhe'],['id_personal_123456789','Detalhe pessoal']];
  tables['Respostas']=[['ID','Dados JSON'],['id_personal_123456789',JSON.stringify({nome:'Ana Teste',resposta:'Resposta'})]];
  const plan=ctx.memberDeletionPlan('ana@test.com');
  assert.ok(plan.sheets.some(s=>s.name==='Dependências'));
  assert.ok(plan.sheets.some(s=>s.name==='Respostas'));
});
test('pastas no Drive são recusadas antes de excluir qualquer arquivo', () => {
  const {ctx,confirm,deletedFiles,tables}=setup();
  confirm({email:'ana@test.com',target:'ana@test.com',operation:'requestDeletion'});
  ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({mimeType:'application/vnd.google-apps.folder',capabilities:{canDelete:true}})});
  assert.throws(()=>ctx.memberDelete({email:'admin@test.com',target:'ana@test.com',operation:'delete',fingerprint:ctx.memberDeletionPlan('ana@test.com').fingerprint}),/pasta/);
  assert.equal(deletedFiles.length,0); assert.equal(tables['Usuários'].length,4);
});
