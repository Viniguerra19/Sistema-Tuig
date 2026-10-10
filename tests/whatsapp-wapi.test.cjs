const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(overrides = {}) {
  const props = {
    WAPI_INSTANCE_ID: 'instance-test', WAPI_TOKEN: 'token-test',
    WAPI_WEBHOOK_SECRET: 'secret-test', WAPI_WEBHOOK_URL: 'https://script.google.com/macros/s/test/exec',
    WHATSAPP_PROVIDER: 'meta', ...overrides
  };
  const requests = [];
  const context = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] || null }) },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, options });
      return { getResponseCode: () => 200, getContentText: () => '{"ok":true}' };
    } }
  });
  vm.runInContext(fs.readFileSync('WhatsApp.gs', 'utf8'), context);
  return { context, requests };
}

test('configuração antiga de provedor não desvia envios da W-API', () => {
  const { context, requests } = load();
  assert.equal(context.waGetConfig().provider, 'wapi');
  context.waWapiRequest('post', '/v1/message/send-text', { phone: '5511999999999', message: 'Teste' });
  assert.equal(requests[0].url, 'https://api.w-api.app/v1/message/send-text?instanceId=instance-test');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token-test');
  assert.equal(JSON.parse(requests[0].options.payload).message, 'Teste');
});

test('W-API exige suas próprias credenciais e dados de mídia', () => {
  const { context, requests } = load({ WAPI_TOKEN: '' });
  assert.throws(() => context.waGetConfig(), /WAPI_TOKEN/);
  assert.throws(() => context.waDownloadIncomingMedia({ mediaId: 'old-id', mimetype: 'image/png' }), /dados necessários/);
  assert.equal(requests.length, 0);
});
