const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('WhatsApp.gs', 'utf8');

function load() {
  const calls = [];
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Utilities: { base64Encode: () => '', getUuid: () => 'uuid' },
    SpreadsheetApp: {},
    UrlFetchApp: {},
    DriveApp: {},
    LockService: {},
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    ContentService: {},
    waSetSession: (key, state, data) => calls.push({ type: 'session', key, state, data }),
    waSendText: (to, message) => calls.push({ type: 'message', to, message })
  });
  // Somente as duas funções novas são avaliadas; o restante do bot não é simulado neste teste.
  const helperStart = source.indexOf('function waReceivePaymentObservation');
  const helperEnd = source.indexOf('\nfunction waDownloadIncomingMedia', helperStart);
  vm.runInContext(source.slice(helperStart, helperEnd), context);
  return { context, calls };
}

test('WhatsApp aceita observação e a mantém até o envio da mídia', () => {
  const { context, calls } = load();
  context.waReceivePaymentObservation({ key: 'pessoa', replyTo: '5511' }, { data: { mes: 'Agosto', ano: 2026 } }, 'Paguei dois meses juntos', 'PAGUEI DOIS MESES JUNTOS');
  assert.deepEqual(calls[0], { type: 'session', key: 'pessoa', state: 'AWAITING_PAYMENT_MEDIA', data: { mes: 'Agosto', ano: 2026, obs: 'Paguei dois meses juntos' } });
  assert.match(calls[1].message, /Agora envie a imagem/);
  assert.equal(context.waBuildPaymentObservation('Paguei dois meses juntos'), 'Enviado pelo WhatsApp\nObservação: Paguei dois meses juntos');
});

test('WhatsApp permite pular observação e limita textos excessivos', () => {
  const { context, calls } = load();
  context.waReceivePaymentObservation({ key: 'pessoa', replyTo: '5511' }, { data: { mes: 'Agosto' } }, 'PULAR', 'PULAR');
  assert.equal(calls[0].data.obs, '');
  assert.equal(context.waBuildPaymentObservation(''), 'Enviado pelo WhatsApp');
  calls.length = 0;
  context.waReceivePaymentObservation({ key: 'pessoa', replyTo: '5511' }, { data: { mes: 'Agosto' } }, 'x'.repeat(1001), 'X');
  assert.equal(calls[0].type, 'message');
  assert.match(calls[0].message, /1000 caracteres/);
});
