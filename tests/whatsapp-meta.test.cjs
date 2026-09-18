const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const source = fs.readFileSync('WhatsApp.gs', 'utf8');
  const properties = new Map([
    ['WHATSAPP_PROVIDER', 'meta'],
    ['META_PHONE_NUMBER_ID', '123456789012345'],
    ['META_ACCESS_TOKEN', 'token-for-test'],
    ['META_VERIFY_TOKEN', 'verify-for-test'],
    ['META_WEBHOOK_SECRET', 'secret-for-test'],
    ['META_GRAPH_VERSION', 'v23.0']
  ]);
  const requests = [], handled = [], audit = [];
  const ctx = vm.createContext({
    console, Date, JSON, Math, isFinite,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value)
    }) },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({url, options});
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({messages:[{id:'wamid.test'}]}) };
    } },
    ContentService: { createTextOutput: value => ({value}) },
    waAuditWebhook: (...args) => audit.push(args),
    handleWhatsAppWebhook: (payload, event) => handled.push({payload, event}),
    createJsonResponse: data => data
  });
  vm.runInContext(source, ctx);
  // Substitui os pontos de integração para testar só o adaptador Meta;
  // o fluxo conversacional completo já possui sua própria suíte.
  ctx.handleWhatsAppWebhook = (payload, event) => handled.push({payload, event});
  ctx.waAuditWebhook = (...args) => audit.push(args);
  return {ctx, requests, handled, audit};
}

test('API oficial Meta valida webhook, normaliza mensagem e envia texto pelo Graph API', () => {
  const {ctx, requests, handled} = setup();
  const verification = ctx.handleMetaWhatsAppVerification({parameter:{
    'hub.mode':'subscribe', 'hub.verify_token':'verify-for-test', 'hub.challenge':'challenge-123'
  }});
  assert.equal(verification.value, 'challenge-123');

  const payload = {object:'whatsapp_business_account', entry:[{changes:[{field:'messages', value:{
    metadata:{phone_number_id:'123456789012345'},
    contacts:[{wa_id:'34600111222', profile:{name:'Pessoa Espanha'}}],
    messages:[{from:'34600111222', id:'wamid.1', timestamp:'1770000000', type:'text', text:{body:'Olá'}}]
  }}]}]};
  const result = ctx.handleMetaWhatsAppWebhook(payload, {parameter:{meta_secret:'secret-for-test'}});
  assert.equal(result.status, 'ok');
  assert.equal(result.processed, 1);
  assert.equal(handled.length, 1);
  assert.equal(handled[0].payload.sender.phone, '34600111222');
  assert.equal(handled[0].payload.msgContent.conversation, 'Olá');
  assert.equal(handled[0].event.parameter.wa_secret, 'secret-for-test');

  ctx.waMetaSendText('34 600 111 222', 'Resposta de teste');
  assert.match(requests.at(-1).url, /graph\.facebook\.com\/v23\.0\/123456789012345\/messages$/);
  const sent = JSON.parse(requests.at(-1).options.payload);
  assert.equal(sent.to, '34600111222');
  assert.equal(sent.type, 'text');
  assert.equal(sent.text.body, 'Resposta de teste');
});

test('webhook Meta rejeita segredo incorreto e eventos de outro número', () => {
  const {ctx, handled, audit} = setup();
  const denied = ctx.handleMetaWhatsAppWebhook({object:'whatsapp_business_account',entry:[]}, {parameter:{meta_secret:'wrong'}});
  assert.equal(denied.status, 'error');
  assert.equal(denied.message, 'Webhook não autorizado.');
  assert.equal(handled.length, 0);
  assert.equal(audit.length, 1);

  const payload = {object:'whatsapp_business_account', entry:[{changes:[{field:'messages', value:{
    metadata:{phone_number_id:'different'}, messages:[{from:'34600111222',id:'x',timestamp:'1770000000',type:'text',text:{body:'ignorar'}}]
  }}]}]};
  const result = ctx.handleMetaWhatsAppWebhook(payload, {parameter:{meta_secret:'secret-for-test'}});
  assert.equal(result.status, 'ok');
  assert.equal(result.processed, 0);
  assert.equal(handled.length, 0);
  assert.equal(audit.length, 1);
});
