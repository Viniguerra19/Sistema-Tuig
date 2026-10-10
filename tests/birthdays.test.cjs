const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

function setup() {
  const tables = { 'Usuários': [['Email','Nome','','','','Turma','','','Status','Aniversario']],
    sexta: [['Nome','Data']], sabado: [['Nome completo','Data de aniversario']] };
  const formulas = {}, props = new Map(), sent = [], triggers = [], writes = [];
  let now = new Date('2026-09-22T11:00:00Z'), response = 200, networkError = false;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } }
  const sheet = name => ({ getName: () => name,
    getDataRange: () => ({ getValues: () => tables[name].map(r => [...r]), getFormulas: () => tables[name].map((r, i) => formulas[name]?.[i] || []) }),
    getRange: (row, col, height = 1, width = 1) => ({
      getValue: () => tables[name][row - 1]?.[col - 1] ?? '',
      getFormula: () => formulas[name]?.[row - 1]?.[col - 1] || '',
      getValues: () => tables[name].slice(row - 1, row - 1 + height).map(r => r.slice(col - 1, col - 1 + width)),
      setNumberFormat() { return this; },
      setValue(value) { tables[name][row - 1][col - 1] = value; writes.push([name,row,col,value]); return this; }
    }) });
  const ss = { getSpreadsheetTimeZone: () => 'America/Sao_Paulo', getSheets: () => Object.keys(tables).map(sheet), getSheetByName: name => tables[name] ? sheet(name) : null };
  const format = (date, tz, pattern) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:tz, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p => [p.type,p.value]));
    return pattern === 'dd/MM' ? parts.day + '/' + parts.month : parts.year + '-' + parts.month + '-' + parts.day;
  };
  const ctx = vm.createContext({ Date: Clock, console,
    SpreadsheetApp: {openById: () => ss}, Logger: {log() {}},
    Utilities: {formatDate: format, DigestAlgorithm:{SHA_256:'sha256'}, computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()]},
    LockService: {getScriptLock: () => ({ waitLock() {}, releaseLock() {} })},
    PropertiesService: {getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) })},
    UrlFetchApp: {fetch: (url, options) => { sent.push(JSON.parse(options.payload)); if(networkError) throw new Error('timeout'); return {getResponseCode: () => response, getContentText: () => '{"success":true}'}; }},
    ScriptApp: {getProjectTriggers: () => triggers.map(handler => ({getHandlerFunction: () => handler})), deleteTrigger: trigger => {
      const index = triggers.indexOf(trigger.getHandlerFunction()); if(index >= 0) triggers.splice(index,1);
    }, newTrigger: handler => {
      const builder = {timeBased() {return this;},atHour() {return this;},everyDays() {return this;},inTimezone() {return this;},create() {triggers.push(handler);} }; return builder;
    }}
  });
  vm.runInContext(fs.readFileSync('Code.gs','utf8') + '\n' + fs.readFileSync('Aniversarios.gs','utf8'), ctx);
  const user = (name = 'Ana Silva', birthday = '', group = 'Sexta', email = 'ana@test.com', status = '') => [email,name,'','','',group,'','',status,birthday];
  const enable = () => Object.entries({ANIVERSARIOS_ATIVO:'SIM', ANIVERSARIOS_WAPI_INSTANCE_ID:'test',ANIVERSARIOS_WAPI_TOKEN:'secret',ANIVERSARIOS_AVISO_TELEFONE:'5511999999999',ANIVERSARIOS_GRUPO_SEXTA:'123@g.us',ANIVERSARIOS_GRUPO_SABADO:'456@g.us',ANIVERSARIOS_GRUPO_DOMINGO:'789@g.us'}).forEach(([k,v]) => props.set(k,v));
  return {ctx,tables,formulas,props,sent,triggers,writes,user,enable, setResponse: code => {response=code;},setTimeout: () => {networkError=true;},setNow: value => {now=new Date(value);} };
}

test('datas brasileiras e ISO; rejeita dias impossíveis; aceita 29/02 sem inventar ano', () => {
  const {ctx} = setup();
  for (const [input, expected] of [['19/06/1999','19/06'],['19/06/2026','19/06'],['2026-06-19','19/06'],['29/02','29/02'],['29/02/2025',null],['31/04',null],['13/13',null],['June 19',null],['',null]]) assert.equal(ctx.anivDay(input,'America/Sao_Paulo'),expected);
});
test('migra apenas nome completo único e turma correspondente; preserva datas e fórmulas', () => {
  const {ctx,tables,formulas,user,writes} = setup();
  tables['Usuários'].push(user('Ána Silva'), user('Bia Lima','04/05'), user('Caio Silva','', 'Domingo'), user('Davi Lima'), user('Davi Lima','','Sexta','other@test.com'), user('Eva Lima'), user('Fabi Lima'), user('Gabi Lima'), user('Hugo'));
  tables['Usuários'].slice(2).forEach((r,i) => {r[0] = 'u' + i + '@test.com';});
  formulas['Usuários'] = []; formulas['Usuários'][6] = []; formulas['Usuários'][6][9] = '=IF(TRUE,"","")';
  tables.sexta.push([' Ana  Silva ','19/06/2025'],['Bia Lima','04/05/2025'],['Caio Silva','12/01'],['Davi Lima','03/04'],['Eva Lima','02/06'],['Fabi Lima','03/03'],['Fabi Lima','04/03'],['Gabi Lima','31/04'],['Hugo','01/01'],['Não Cadastrado','01/02']);
  const preview = ctx.simularMigracaoAniversarios();
  assert.equal(preview.preencher.length,1); assert.equal(preview.preservados.length,1); assert.equal(preview.pendencias.length,7); assert.equal(writes.length,0);
  ctx.migrarAniversariosParaUsuarios();
  assert.equal(tables['Usuários'][1][9],'19/06'); assert.equal(tables['Usuários'][2][9],'04/05'); assert.equal(writes.length,1);
  ctx.migrarAniversariosParaUsuarios(); assert.equal(writes.length,1);
});
test('e-mail duplicado e coluna J ocupada por outra informação bloqueiam escrita', () => {
  const {ctx,tables,user,writes} = setup();
  tables['Usuários'].push(user(),user('Outra Pessoa')); tables.sexta.push(['Ana Silva','01/01']);
  assert.equal(ctx.simularMigracaoAniversarios().preencher.length,0);
  tables['Usuários'][0][9]='Telefone'; assert.throws(() => ctx.migrarAniversariosParaUsuarios(),/outro cabeçalho/); assert.equal(writes.length,0);
});
test('aniversariantes consideram fuso da planilha, situação e turma explícita', () => {
  const {ctx,tables,user,setNow} = setup();
  tables['Usuários'].push(user('Ana Silva','22/09','Domingo'), user('Bia Lima','22/09','Ambos','b@test.com'),user('Caio Silva','22/09','Sexta','c@test.com','Afastado'));
  setNow('2026-09-23T01:00:00Z');
  const plan = ctx.visualizarAniversariosHoje(); assert.equal(plan.data,'2026-09-22'); assert.equal(plan.aniversariantes.length,1); assert.equal(plan.pendencias.length,1);
  setNow('2026-09-23T04:00:00Z'); assert.equal(ctx.visualizarAniversariosHoje().aniversariantes.length,0);
});
test('rotina desativada e prévias nunca enviam; ativada envia pessoal e grupos uma vez', () => {
  const {ctx,tables,user,enable,sent} = setup();
  tables['Usuários'].push(user('Ana Silva','22/09','Sexta, Domingo'));
  ctx.verificarAniversariosTuig(); ctx.visualizarAniversariosHoje(); assert.equal(sent.length,0);
  enable(); assert.equal(ctx.verificarAniversariosTuig().aceitos,3); assert.equal(ctx.verificarAniversariosTuig().ignorados,3); assert.equal(sent.length,3);
});
test('falha HTTP ou timeout não reenviam tentativa incerta; destinos são independentes', () => {
  for (const timeout of [false,true]) {
    const {ctx,tables,user,enable,sent,setResponse,setTimeout} = setup();
    tables['Usuários'].push(user('Ana Silva','22/09')); enable(); if(timeout) setTimeout(); else setResponse(500);
    assert.throws(() => ctx.verificarAniversariosTuig(),/conferir/); assert.equal(sent.length,2);
    assert.throws(() => ctx.verificarAniversariosTuig(),/conferir/); assert.equal(sent.length,2);
  }
});
test('grupo opcional mantém aviso pessoal; ativação cria um gatilho e pode ser pausada', () => {
  const {ctx,tables,user,enable,props,sent,triggers} = setup();
  tables['Usuários'].push(user('Ana Silva','22/09','Domingo')); enable(); props.delete('ANIVERSARIOS_GRUPO_DOMINGO');
  assert.equal(ctx.verificarAniversariosTuig().aceitos,1); assert.equal(sent.length,1);
  ctx.configurarGatilhoAniversariosTuig();ctx.configurarGatilhoAniversariosTuig();assert.equal(triggers.length,1);
  assert.equal(props.get('ANIVERSARIOS_ATIVO'),'SIM');
  triggers.push('verificarAniversarios'); assert.throws(() => ctx.configurarGatilhoAniversariosTuig(),/gatilho antigo/);
  ctx.pausarAniversariosTuig(); assert.equal(props.get('ANIVERSARIOS_ATIVO'),'NAO'); assert.deepEqual(triggers,['verificarAniversarios']);
});
test('instalação usa credenciais W-API existentes e o número pessoal antigo', () => {
  const {ctx,tables,user,props,sent,triggers} = setup();
  tables['Usuários'].push(user('Ana Silva','22/09'));
  props.set('WAPI_INSTANCE_ID','instancia'); props.set('WAPI_TOKEN','token');
  assert.match(ctx.configurarGatilhoAniversariosTuig(),/ativado/); assert.equal(triggers.length,1);
  assert.equal(ctx.verificarAniversariosTuig().aceitos,1); assert.equal(sent[0].phone,'5511934615897');
});
