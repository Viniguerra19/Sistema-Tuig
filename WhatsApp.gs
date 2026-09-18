/**
 * TUIG - Frontend conversacional via WhatsApp
 *
 * Provedor legado (W-API), em Configurações do projeto > Propriedades do script:
 *   WAPI_INSTANCE_ID
 *   WAPI_TOKEN
 *   WAPI_WEBHOOK_SECRET
 *   WAPI_WEBHOOK_URL (URL pública da implantação, terminada em /exec)
 *
 * Provedor oficial Meta Cloud API:
 *   WHATSAPP_PROVIDER=meta
 *   META_PHONE_NUMBER_ID
 *   META_ACCESS_TOKEN (token permanente de sistema, nunca o token do frontend)
 *   META_VERIFY_TOKEN (usado somente na validação inicial do webhook)
 *   META_WEBHOOK_SECRET (segredo aleatório usado na URL do callback)
 *   META_WEBHOOK_URL (URL pública /exec; aceita WAPI_WEBHOOK_URL como fallback)
 *   META_GRAPH_VERSION (por exemplo, v23.0; use a versão disponível no painel Meta)
 *   META_WABA_ID (opcional; usado por configureWhatsAppReceivedWebhook)
 *
 * Para a Meta, o callback deve apontar para:
 *   META_WEBHOOK_URL?meta_secret=VALOR_DE_META_WEBHOOK_SECRET
 */

const WA_USERS_SHEET = "WhatsApp Usuários";
const WA_SESSIONS_SHEET = "WhatsApp Sessões";
const WA_EVENTS_SHEET = "WhatsApp Eventos";
const WA_INVITES_SHEET = "WhatsApp Convites";
const WA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const WA_OTP_TTL_MS = 10 * 60 * 1000;
const WA_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const WA_MAX_OTP_ATTEMPTS = 5;
const WA_MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const WA_MAX_MENU_ITEMS = 9;
const WA_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Contexto temporário da execução atual. A W-API só pode receber uma resposta
// para o mesmo chat que acabou de disparar um webhook válido e autorizado.
let WA_REPLY_CONTEXT = null;

// ==========================================
// SETUP E WEBHOOK
// ==========================================

function waEnsureSupportSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = waGetOrCreateSheet(ss, WA_USERS_SHEET, [
    "Email", "Nome", "Telefone", "LID", "Consentimento", "Status",
    "Vinculado em", "Último contato"
  ]);
  waEnsureActivationColumns(usersSheet);
  waGetOrCreateSheet(ss, WA_SESSIONS_SHEET, [
    "Chave", "Estado", "Dados JSON", "Atualizado em"
  ]);
  waGetOrCreateSheet(ss, WA_EVENTS_SHEET, [
    "Chave", "Recebido em", "Evento", "Remetente", "Status", "Erro"
  ]);
  const inviteSheet = waGetOrCreateSheet(ss, WA_INVITES_SHEET, [
    "Código", "Telefone", "Estado", "Criado em", "Expira em", "Ativado em", "LID", "Linha usuário", "Detalhe"
  ]);
  if (!inviteSheet.isSheetHidden() && ss.getSheets().length > 1) inviteSheet.hideSheet();
}

function configureWhatsAppReceivedWebhook() {
  waEnsureSupportSheets();
  waEnsureActivationEditTrigger();
  const config = waGetConfig();
  if (config.provider === "meta") return configureMetaWhatsAppWebhook(config);
  const webAppUrl = config.webhookUrl;
  if (!webAppUrl) {
    throw new Error("Defina WAPI_WEBHOOK_URL nas Propriedades do script com a URL pública /exec da implantação.");
  }
  if (!/^https:\/\/script\.google\.com(?:\/a\/[^/]+)?\/macros\/s\/[^/]+\/exec\/?$/.test(webAppUrl)) {
    throw new Error("WAPI_WEBHOOK_URL deve ser a URL pública do Apps Script terminada em /exec. URLs /dev não servem para a W-API.");
  }

  const callbackUrl = webAppUrl + "?wa_secret=" + encodeURIComponent(config.webhookSecret);
  const response = waWapiRequest("put", "/v1/webhook/update-webhook-received", {
    value: callbackUrl
  });
  // Alguns provedores entregam mensagens que ficaram pendentes antes do
  // cadastro do webhook. Guardamos o marco de ativação para não responder
  // automaticamente a conversas antigas.
  PropertiesService.getScriptProperties().setProperty("WAPI_WEBHOOK_ACTIVATED_AT", String(new Date().getTime()));

  return {
    ok: true,
    callbackUrl: webAppUrl + "?wa_secret=<SEGREDO_CONFIGURADO>",
    wapiResponse: response,
    activatedAt: new Date().toISOString()
  };
}

/**
 * Confere o callback da Meta e, quando META_WABA_ID foi informado, assina o
 * aplicativo no WhatsApp Business Account. A URL e o META_VERIFY_TOKEN ainda
 * precisam ser cadastrados no painel Meta for Developers, na seção Webhooks.
 */
function configureMetaWhatsAppWebhook(config) {
  const webAppUrl = config.webhookUrl;
  if (!webAppUrl) throw new Error("Defina META_WEBHOOK_URL nas Propriedades do script com a URL pública /exec da implantação.");
  if (!/^https:\/\/script\.google\.com(?:\/a\/[^/]+)?\/macros\/s\/[^/]+\/exec\/?$/.test(webAppUrl)) {
    throw new Error("META_WEBHOOK_URL deve ser a URL pública do Apps Script terminada em /exec.");
  }
  const callbackUrl = webAppUrl.replace(/\/$/, "") + "?meta_secret=" + encodeURIComponent(config.webhookSecret);
  let subscription = null;
  if (config.wabaId) {
    subscription = waMetaRequest("post", "/" + encodeURIComponent(config.wabaId) + "/subscribed_apps");
  }
  PropertiesService.getScriptProperties().setProperty("META_WEBHOOK_ACTIVATED_AT", String(new Date().getTime()));
  return {
    ok: true,
    provider: "meta",
    callbackUrl: webAppUrl.replace(/\/$/, "") + "?meta_secret=<SEGREDO_CONFIGURADO>",
    subscription: subscription,
    activatedAt: new Date().toISOString(),
    next: "Cadastre essa URL e o META_VERIFY_TOKEN no painel Meta for Developers e assine o campo messages."
  };
}

function waEnsureActivationColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const hasActivation = headers.some(function (header) {
    return waNormalizeCommand(header) === "ATIVAR BOT";
  });
  if (!hasActivation) {
    const column = sheet.getLastColumn() + 1;
    sheet.getRange(1, column).setValue("Ativar bot").setFontWeight("bold");
    sheet.getRange(2, column, Math.max(1, sheet.getMaxRows() - 1), 1).insertCheckboxes();
  }
}

function waEnsureActivationEditTrigger() {
  const handler = "waHandleActivationCheckboxEdit";
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler).forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  }
}

function waHandleActivationCheckboxEdit(e) {
  if (!e || !e.range || (e.value || "").toString().toUpperCase() !== "TRUE") return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== WA_USERS_SHEET || e.range.getRow() < 2) return;
  waEnsureActivationColumns(sheet);
  const columns = waGetUserSheetColumns(sheet);
  if (e.range.getColumn() !== columns.activate) return;

  const rowIndex = e.range.getRow();
  let invite = null;
  try {
    const phone = waPhoneFromWebhookValue(sheet.getRange(rowIndex, columns.phone).getValue());
    if (!phone) throw new Error("Telefone inválido: informe o número completo com DDI.");
    const status = columns.status ? waNormalizeCommand(sheet.getRange(rowIndex, columns.status).getValue()) : "";
    if (status === "BLOQUEADO" || status === "INATIVO") throw new Error("Número " + status.toLowerCase() + ".");
    const email = columns.email ? sheet.getRange(rowIndex, columns.email).getValue().toString().trim() : "";
    const lid = columns.lid ? sheet.getRange(rowIndex, columns.lid).getValue().toString().trim() : "";
    const linkedAt = columns.linkedAt ? sheet.getRange(rowIndex, columns.linkedAt).getValue() : "";
    if (email && lid && linkedAt && status === "ATIVO") throw new Error("Esse número já está vinculado a uma conta ativa.");

    invite = waCreateActivationInvite(phone, rowIndex);
    waSendActivationInvite(phone, invite.code);
    waUpdateActivationInvite(invite.rowIndex, "Enviado", "Convite enviado pela caixa Ativar bot.");
    e.range.setNote("Convite enviado em " + new Date().toLocaleString("pt-BR") + ". Aguardando ATIVAR " + invite.code + ".");
  } catch (error) {
    const detail = error && error.message ? error.message : error.toString();
    if (invite) waUpdateActivationInvite(invite.rowIndex, "Falha de envio", detail);
    e.range.setNote("Não enviado: " + detail);
    console.error("Falha na ativação WhatsApp: " + detail);
  } finally {
    e.range.setValue(false);
  }
}

// ==========================================
// ATIVAÇÃO INDIVIDUAL PELA PLANILHA
// ==========================================

function waGetUserSheetColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columns = {};
  headers.forEach(function (header, index) {
    const normalized = waNormalizeCommand(header);
    if (normalized === "EMAIL") columns.email = index + 1;
    if (normalized === "TELEFONE") columns.phone = index + 1;
    if (normalized === "LID") columns.lid = index + 1;
    if (normalized === "STATUS") columns.status = index + 1;
    if (normalized === "VINCULADO EM") columns.linkedAt = index + 1;
    if (normalized === "ATIVAR BOT") columns.activate = index + 1;
  });
  if (!columns.phone) throw new Error("Não encontrei a coluna 'Telefone' na aba WhatsApp Usuários.");
  return columns;
}

function waCreateActivationInvite(phone, userRowIndex) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_INVITES_SHEET, [
      "Código", "Telefone", "Estado", "Criado em", "Expira em", "Ativado em", "LID", "Linha usuário", "Detalhe"
    ]);
    const values = sheet.getDataRange().getValues();
    const now = new Date();
    for (let i = 1; i < values.length; i++) {
      const existingPhone = waNormalizePhone(values[i][1]);
      const state = waNormalizeCommand(values[i][2]);
      const expiresAt = values[i][4] instanceof Date ? values[i][4].getTime() : new Date(values[i][4]).getTime();
      if (existingPhone === phone && state === "ENVIADO" && expiresAt > now.getTime()) {
        throw new Error("Já existe um convite ativo para esse número. Aguarde a resposta ou o vencimento de 24 horas.");
      }
      if ((state === "ENVIADO" || state === "PENDENTE") && expiresAt && expiresAt <= now.getTime()) {
        sheet.getRange(i + 1, 3).setValue("Expirado");
      }
    }
    const code = waGenerateActivationCode();
    const expiresAt = new Date(now.getTime() + WA_INVITE_TTL_MS);
    sheet.appendRow([code, phone, "Pendente", now, expiresAt, "", "", userRowIndex, "Aguardando envio."]);
    return { code: code, phone: phone, rowIndex: sheet.getLastRow(), expiresAt: expiresAt };
  } finally {
    lock.releaseLock();
  }
}

function waUpdateActivationInvite(rowIndex, state, detail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WA_INVITES_SHEET);
  if (!sheet || rowIndex < 2) return;
  sheet.getRange(rowIndex, 3).setValue(state);
  sheet.getRange(rowIndex, 9).setValue(detail || "");
}

function waSendActivationInvite(phone, code) {
  const message =
    "*TUIG*\n\n" +
    "Seu acesso pelo WhatsApp foi liberado pela administração. Para confirmar este número, responda exatamente:\n\n" +
    "*ATIVAR " + code + "*\n\n" +
    "O código é pessoal e expira em 24 horas. Se você não solicitou este acesso, ignore esta mensagem.";
  return waWapiRequest("post", "/v1/message/send-text", {
    phone: phone,
    message: message,
    delayMessage: 1
  });
}

function waExtractActivationCode(text) {
  const normalized = (text || "").toString().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "").trim();
  const match = normalized.match(/^ATIVAR\s+([A-F0-9]{8})$/);
  return match ? match[1] : "";
}

function waTryRedeemActivationInvite(text, identity) {
  const code = waExtractActivationCode(text);
  if (!code) return null;

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const inviteSheet = ss.getSheetByName(WA_INVITES_SHEET);
    if (!inviteSheet) return null;
    const values = inviteSheet.getDataRange().getValues();
    const now = new Date();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString().trim().toUpperCase() !== code) continue;
      const state = waNormalizeCommand(values[i][2]);
      const phone = waNormalizePhone(values[i][1]);
      const expiresAt = values[i][4] instanceof Date ? values[i][4].getTime() : new Date(values[i][4]).getTime();
      if (state !== "ENVIADO" || !phone || !expiresAt || expiresAt < now.getTime()) {
        if (expiresAt && expiresAt < now.getTime()) inviteSheet.getRange(i + 1, 3).setValue("Expirado");
        return null;
      }
      // Um telefone informado pela W-API precisa coincidir com o telefone do
      // convite. Se ela trouxe apenas LID, o código único faz essa associação.
      if (identity.phone && waNormalizePhone(identity.phone) !== phone) {
        inviteSheet.getRange(i + 1, 9).setValue("Tentativa recusada: telefone do webhook não corresponde ao convite.");
        return null;
      }

      const userSheet = waGetOrCreateSheet(ss, WA_USERS_SHEET, [
        "Email", "Nome", "Telefone", "LID", "Consentimento", "Status", "Vinculado em", "Último contato"
      ]);
      const userValues = userSheet.getDataRange().getValues();
      let userRowIndex = Number(values[i][7]) || -1;
      const selectedRowMatches = userRowIndex > 1 && userValues[userRowIndex - 1] &&
        waNormalizePhone(userValues[userRowIndex - 1][2]) === phone;
      if (!selectedRowMatches) {
        userRowIndex = -1;
        for (let j = 1; j < userValues.length; j++) {
          if (waNormalizePhone(userValues[j][2]) === phone) {
            userRowIndex = j + 1;
            break;
          }
        }
      }
      if (userRowIndex < 2) {
        inviteSheet.getRange(i + 1, 3, 1, 7).setValues([["Falha", values[i][3], values[i][4], "", "", values[i][7], "Telefone removido da allowlist antes da confirmação."]]);
        return null;
      }

      const currentLid = userValues[userRowIndex - 1][3] ? userValues[userRowIndex - 1][3].toString().trim() : "";
      if (currentLid && identity.lid && currentLid !== identity.lid) {
        inviteSheet.getRange(i + 1, 9).setValue("Tentativa recusada: a linha já está associada a outro LID.");
        return null;
      }
      if (identity.lid) userSheet.getRange(userRowIndex, 4).setValue(identity.lid);
      userSheet.getRange(userRowIndex, 5).setValue("Sim");
      if (!userValues[userRowIndex - 1][5]) userSheet.getRange(userRowIndex, 6).setValue("Ativação pendente");
      userSheet.getRange(userRowIndex, 8).setValue(now);
      inviteSheet.getRange(i + 1, 3, 1, 7).setValues([[
        "Ativado", values[i][3], values[i][4], now, identity.lid || "", userRowIndex, "Código confirmado pelo destinatário."
      ]]);
      return { code: code, phone: phone, userRowIndex: userRowIndex };
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}

function waAttachInvitationToIdentity(identity, invite) {
  const replyCandidates = waUniqueStrings([invite.phone].concat(identity.replyCandidates || []));
  return {
    phone: invite.phone,
    lid: identity.lid,
    replyTo: replyCandidates[0],
    replyCandidates: replyCandidates,
    key: identity.key,
    pushName: identity.pushName,
    activationInvite: invite
  };
}

function isMetaWhatsAppVerificationRequest(e) {
  const params = e && e.parameter ? e.parameter : {};
  return Boolean((params["hub.mode"] || params.hub_mode) && (params["hub.challenge"] || params.hub_challenge));
}

function handleMetaWhatsAppVerification(e) {
  const config = waGetConfig();
  const params = e && e.parameter ? e.parameter : {};
  const mode = (params["hub.mode"] || params.hub_mode || "").toString();
  const token = (params["hub.verify_token"] || params.hub_verify_token || "").toString();
  const challenge = (params["hub.challenge"] || params.hub_challenge || "").toString();
  if (config.provider !== "meta" || mode !== "subscribe" || !challenge || !waSafeEquals(token, config.verifyToken)) {
    return ContentService.createTextOutput("Webhook não autorizado.");
  }
  return ContentService.createTextOutput(challenge);
}

function isMetaWhatsAppWebhookPayload(payload) {
  return Boolean(payload && payload.object === "whatsapp_business_account" && Array.isArray(payload.entry));
}

function waMetaMessagePayload(message, value) {
  const contacts = value && Array.isArray(value.contacts) ? value.contacts : [];
  const contact = contacts.find(function (item) { return item && item.wa_id && item.wa_id.toString() === message.from.toString(); }) || contacts[0] || {};
  const profile = contact.profile && typeof contact.profile === "object" ? contact.profile : {};
  const type = (message.type || "").toString().toLowerCase();
  const content = {};
  if (type === "text") content.conversation = message.text && message.text.body ? message.text.body : "";
  else if (type === "image" && message.image) content.imageMessage = {
    id: message.image.id, mimetype: message.image.mime_type, caption: message.image.caption || ""
  };
  else if (type === "document" && message.document) content.documentMessage = {
    id: message.document.id, mimetype: message.document.mime_type, fileName: message.document.filename,
    caption: message.document.caption || ""
  };
  else if (type === "location" && message.location) content.locationMessage = {
    degreesLatitude: message.location.latitude, degreesLongitude: message.location.longitude
  };
  else if (type === "button" && message.button) content.buttonsResponseMessage = {
    selectedButtonId: message.button.payload || message.button.text || ""
  };
  else if (type === "interactive" && message.interactive) {
    const interactive = message.interactive;
    const reply = interactive.button_reply || interactive.list_reply;
    content.listResponseMessage = { singleSelectReply: { selectedRowId: reply && (reply.id || reply.title) || "" } };
  }
  return {
    event: "webhookReceived",
    instanceId: value && value.metadata ? value.metadata.phone_number_id : "",
    messageId: message.id || "",
    timestamp: message.timestamp || "",
    sender: { id: message.from || "", phone: message.from || "", pushName: profile.name || "" },
    chat: { id: message.from || "", phone: message.from || "" },
    msgContent: content,
    isGroup: false
  };
}

function handleMetaWhatsAppWebhook(payload, e) {
  let config;
  try {
    config = waGetConfig();
    const params = e && e.parameter ? e.parameter : {};
    const receivedSecret = params.meta_secret ? params.meta_secret.toString() : "";
    if (config.provider !== "meta" || !waSafeEquals(config.webhookSecret, receivedSecret)) {
      waAuditWebhook(payload, "Ignorado", "Webhook Meta não autorizado: meta_secret ausente ou diferente.");
      return createJsonResponse({ status: "error", message: "Webhook não autorizado." }, 403);
    }
    let processed = 0;
    (payload.entry || []).forEach(function (entry) {
      (entry.changes || []).forEach(function (change) {
        const value = change && change.value ? change.value : {};
        if (change.field && change.field !== "messages") return;
        if (value.metadata && value.metadata.phone_number_id && value.metadata.phone_number_id !== config.phoneNumberId) return;
        (value.messages || []).forEach(function (message) {
          if (!message || !message.from || message.from === config.displayPhoneNumber) return;
          handleWhatsAppWebhook(waMetaMessagePayload(message, value), { parameter: { wa_secret: config.webhookSecret } });
          processed++;
        });
      });
    });
    return createJsonResponse({ status: "ok", processed: processed });
  } catch (error) {
    waAuditWebhook(payload, "Erro", error && error.message ? error.message : error.toString());
    // A Meta deve receber 200 para não reenfileirar indefinidamente a mesma
    // mensagem; o detalhe completo já fica na aba WhatsApp Eventos.
    return createJsonResponse({ status: "ok", processed: 0 });
  }
}

function isWhatsAppWebhookPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const event = payload.event ? payload.event.toString() : "";
  return event.indexOf("webhook") === 0 || Boolean(payload.msgContent && payload.sender);
}

function handleWhatsAppWebhook(payload, e) {
  let identity = null;
  let eventClaim = null;
  let senderAuthorized = false;

  try {
    const config = waGetConfig();
    const params = e && e.parameter ? e.parameter : {};
    const receivedSecret = params.wa_secret ? params.wa_secret.toString() : "";

    if (!waSafeEquals(config.webhookSecret, receivedSecret)) {
      waAuditWebhook(payload, "Ignorado", "Webhook não autorizado: wa_secret ausente ou diferente.");
      return createJsonResponse({ status: "error", message: "Webhook não autorizado." }, 403);
    }

    const expectedInstance = config.provider === "meta" ? config.phoneNumberId : config.instanceId;
    if (payload.instanceId && expectedInstance && payload.instanceId.toString() !== expectedInstance) {
      waAuditWebhook(payload, "Ignorado", "Instância não autorizada.");
      return createJsonResponse({ status: "error", message: "Instância não autorizada." }, 403);
    }

    // A W-API normalmente envia "webhookReceived". Aceitamos também um payload
    // de mensagem sem o campo event, pois algumas configurações antigas não o incluem.
    const eventName = payload.event ? payload.event.toString() : "";
    if (eventName && eventName !== "webhookReceived") {
      waAuditWebhook(payload, "Ignorado", "Evento não suportado: " + eventName);
      return createJsonResponse({ status: "ok", ignored: true, event: eventName });
    }

    if (waIsMessageBeforeWebhookActivation(payload)) {
      waAuditWebhook(payload, "Ignorado", "Mensagem anterior à ativação do webhook.");
      return createJsonResponse({ status: "ok", ignored: true, reason: "message_before_activation" });
    }

    const chatId = payload.chat && payload.chat.id ? payload.chat.id.toString() : "";
    if (waIsMessageFromInstance(payload) || payload.isGroup === true || chatId.indexOf("@g.us") !== -1) {
      waAuditWebhook(payload, "Ignorado", "Mensagem enviada pela instância ou recebida de grupo.");
      return createJsonResponse({ status: "ok", ignored: true, reason: "fromMe_or_group" });
    }

    identity = waExtractIdentity(payload);
    if (!identity.replyTo || !identity.key) {
      waAuditWebhook(payload, "Ignorado", "Remetente não identificado no payload da W-API.");
      return createJsonResponse({ status: "ok", ignored: true, reason: "sender_not_found" });
    }

    // Convites individuais resolvem o caso em que a W-API entrega somente um
    // LID: o código, enviado manualmente pelo administrador ao telefone da
    // planilha, associa esse LID ao telefone correto sem liberar desconhecidos.
    const activationInvite = waTryRedeemActivationInvite(waExtractText(payload), identity);
    if (activationInvite) {
      identity = waAttachInvitationToIdentity(identity, activationInvite);
    }

    // O número do terreiro pode ser um telefone pessoal. Remetentes fora da
    // coluna Telefone da aba WhatsApp Usuários não recebem nem a saudação de
    // onboarding; só ficam auditados.
    if (!waIsAuthorizedSender(identity)) {
      waAuditWebhook(payload, "Ignorado", "Remetente não autorizado pela allowlist. " + waDescribeIdentity(identity));
      return createJsonResponse({ status: "ok", ignored: true, reason: "sender_not_allowed" });
    }
    senderAuthorized = true;

    eventClaim = waClaimEvent(payload, identity);
    if (eventClaim.duplicate) {
      waAuditWebhook(payload, "Duplicado", "Webhook já processado.");
      return createJsonResponse({ status: "ok", duplicate: true });
    }

    WA_REPLY_CONTEXT = {
      destinations: identity.replyCandidates,
      eventKey: eventClaim.key,
      createdAt: new Date().getTime()
    };
    waProcessIncomingMessage(payload, identity);
    waFinishEvent(eventClaim, "Concluído", "");
    return createJsonResponse({ status: "ok", processed: true });
  } catch (error) {
    const message = error && error.message ? error.message : error.toString();
    console.error("Erro no webhook WhatsApp: " + message);
    if (eventClaim && eventClaim.rowIndex) {
      waFinishEvent(eventClaim, "Erro", message);
    } else {
      waAuditWebhook(payload, "Erro", message);
    }

    // Nunca responda a um remetente que não passou pela allowlist. Isso também
    // vale quando a consulta à planilha ou outra etapa inicial falha.
    if (senderAuthorized && identity && identity.replyTo) {
      try {
        waSendText(identity.replyTo, "Não consegui concluir essa operação agora. Digite *MENU* para tentar novamente.");
      } catch (sendError) {
        console.error("Falha ao responder erro no WhatsApp: " + sendError.toString());
      }
    }

    // Retorna JSON válido para impedir tempestade de retries; o erro fica auditado.
    return createJsonResponse({ status: "error", message: "Falha ao processar webhook." }, 500);
  } finally {
    WA_REPLY_CONTEXT = null;
  }
}

// ==========================================
// ROTEAMENTO CONVERSACIONAL
// ==========================================

function waProcessIncomingMessage(payload, identity) {
  const text = waExtractText(payload).trim();
  const command = waNormalizeCommand(text);
  const location = waExtractLocation(payload);
  const media = waExtractMedia(payload);
  let link = waFindLinkedUser(identity);
  let session = waGetSession(identity.key);

  if (link && !waGetUserRecordByEmail(link.email)) {
    return; // Preserva o vínculo para reativação, mas não atende usuários inativos.
  }

  if (link) waTouchLinkedUser(link.rowIndex, identity);

  if (!link) {
    waHandleOnboarding(identity, session, text, command);
    return;
  }

  if (command === "MENU" || command === "INICIO" || command === "AJUDA") {
    waClearSession(identity.key);
    waSendMainMenu(identity.replyTo, link.email);
    return;
  }

  if ((command === "ADMIN" || command === "PAINEL") && waIsAdmin(link.email)) {
    waClearSession(identity.key);
    waSendAdminMenu(identity.replyTo, link.email);
    return;
  }

  if (command === "CANCELAR") {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "Operação cancelada.");
    waSendMainMenu(identity.replyTo, link.email);
    return;
  }

  if (session.state !== "IDLE") {
    if (waHandleSessionState(payload, identity, link, session, text, command, location, media)) {
      return;
    }
  }

  waHandleMenuCommand(payload, identity, link, text, command, media);
}

function waHandleMenuCommand(payload, identity, link, text, command, media) {
  if (waIsAdmin(link.email) && (/^A[1-9]$/.test(command) || command === "PAINEL")) {
    waHandleAdminMenuCommand(identity, link, command);
    return;
  }

  const receiptMatch = command.match(/^COMPROVANTE\s+(.+)$/);
  if (receiptMatch) {
    const month = waParseMonth(receiptMatch[1]);
    if (!month) {
      waSendText(identity.replyTo, "Não reconheci o mês. Exemplo: *COMPROVANTE AGOSTO*.");
      return;
    }
    const context = { mes: month.name, ano: new Date().getFullYear() };
    if (media) {
      waProcessPaymentReceipt(identity, link, context, media);
    } else {
      waSetSession(identity.key, "AWAITING_PAYMENT_OBSERVATION", context);
      waSendText(identity.replyTo,
        "Quer adicionar uma observação ao comprovante de *" + month.name + "*?\n\nEscreva agora sua observação (ex.: paguei dois meses juntos) ou digite *PULAR*."
      );
    }
    return;
  }

  switch (command) {
    case "1":
    case "PRESENCA":
      waStartPresence(identity, link);
      return;
    case "2":
    case "MEUS DADOS":
    case "DADOS":
      waShowMyData(identity.replyTo, link.email);
      return;
    case "3":
    case "HISTORICO":
      waShowHistory(identity.replyTo, link.email);
      return;
    case "4":
    case "RITUAIS":
      waShowRituals(identity.replyTo, link.email);
      return;
    case "5":
    case "MENSALIDADES":
    case "FINANCEIRO":
      waShowPayments(identity.replyTo, link.email);
      return;
    case "6":
    case "JUSTIFICAR":
    case "JUSTIFICAR FALTA":
      waStartJustification(identity, link);
      return;
    case "7":
    case "CURSOS":
      waStartCourses(identity, link);
      return;
    case "8":
    case "BIBLIOTECA":
    case "LIVROS":
      waStartLibrary(identity, link);
      return;
    case "9":
    case "ADMIN":
      if (waIsAdmin(link.email)) {
        waSendAdminMenu(identity.replyTo, link.email);
      } else {
        waSendText(identity.replyTo, "Essa opção é exclusiva para administradores.");
      }
      return;
    default:
      if (media) {
        waSendText(identity.replyTo,
          "Recebi o arquivo, mas preciso saber onde usá-lo. Para mensalidade, envie primeiro *COMPROVANTE MÊS*."
        );
        return;
      }
      waSendText(identity.replyTo, "Não reconheci essa opção. Digite *MENU* para ver os comandos disponíveis.");
  }
}

function waHandleSessionState(payload, identity, link, session, text, command, location, media) {
  switch (session.state) {
    case "AWAITING_PRESENCE_LOCATION":
      if (!location) {
        waSendText(identity.replyTo,
          "Use o clipe do WhatsApp, escolha *Localização* e envie sua localização atual. Digite *CANCELAR* para cancelar a operação."
        );
        return true;
      }
      waRegisterPresenceFromLocation(identity, link, location);
      return true;

    case "AWAITING_JUSTIFICATION_SELECTION":
      waSelectJustification(identity, link, session, command);
      return true;

    case "AWAITING_JUSTIFICATION_REASON":
      waSubmitJustification(identity, link, session, text);
      return true;

    case "AWAITING_PAYMENT_MEDIA":
      if (!media) {
        waSendText(identity.replyTo, "Envie uma imagem ou PDF do comprovante, ou digite *CANCELAR*.");
        return true;
      }
      waProcessPaymentReceipt(identity, link, session.data, media);
      return true;

    case "AWAITING_PAYMENT_OBSERVATION":
      if (media) {
        waSendText(identity.replyTo, "Antes do arquivo, escreva uma observação ou digite *PULAR*.");
        return true;
      }
      waReceivePaymentObservation(identity, session, text, command);
      return true;

    case "AWAITING_COURSE_SELECTION":
      waSelectCourse(identity, link, session, command);
      return true;

    case "AWAITING_COURSE_MEDIA":
      if (!media) {
        waSendText(identity.replyTo, "Envie a imagem ou PDF do comprovante do curso, ou digite *CANCELAR*.");
        return true;
      }
      waProcessCourseEnrollment(identity, link, session.data.course, media);
      return true;

    case "AWAITING_BOOK_ACTION":
      waHandleBookAction(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_USER_SEARCH":
      waAdminSearchUser(identity, link, text);
      return true;

    case "AWAITING_ADMIN_USER_SELECTION":
      waAdminSelectUser(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_BULK_DATE":
      waAdminLoadBulkDate(identity, link, text);
      return true;

    case "AWAITING_ADMIN_BULK_SELECTION":
      waAdminSelectBulkPresence(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_MEDIUM_SEARCH":
      waAdminSearchMediumForPresence(identity, link, text);
      return true;

    case "AWAITING_ADMIN_MEDIUM_SELECTION":
      waAdminSelectMediumForPresence(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_MEDIUM_DATES":
      waAdminSelectMediumDates(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_PAYMENT_SELECTION":
      waAdminSelectPayment(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_PAYMENT_DECISION":
      waAdminPreparePaymentDecision(identity, link, session, text, command);
      return true;

    case "AWAITING_ADMIN_JUSTIFICATION_SELECTION":
      waAdminSelectJustification(identity, link, session, command);
      return true;

    case "AWAITING_ADMIN_JUSTIFICATION_DECISION":
      waAdminPrepareJustificationDecision(identity, link, session, text, command);
      return true;

    case "AWAITING_ADMIN_LIBRARY_ACTION":
      waAdminHandleLibraryAction(identity, link, session, text, command);
      return true;

    case "AWAITING_ADMIN_RITUAL_SEARCH":
      waAdminSearchRitualReport(identity, link, session, text);
      return true;

    case "AWAITING_ADMIN_CONFIRMATION":
      waAdminConfirmOperation(identity, link, session, command);
      return true;
  }
  return false;
}

// ==========================================
// VINCULAÇÃO E OTP
// ==========================================

function waHandleOnboarding(identity, session, text, command) {
  if (command === "CANCELAR") {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "Identificação cancelada. Quando quiser tentar novamente, envie uma nova mensagem.");
    return;
  }

  if (identity.activationInvite) {
    waSetSession(identity.key, "AWAITING_EMAIL", { inviteCode: identity.activationInvite.code });
    waSendText(identity.replyTo,
      "✅ Convite de ativação confirmado. Agora informe o mesmo e-mail cadastrado no sistema TUIG. Enviaremos um código de confirmação para ele."
    );
    return;
  }

  if (session.state === "AWAITING_CODE") {
    waVerifyOtp(identity, session, command);
    return;
  }

  if (waLooksLikeEmail(text)) {
    waStartEmailVerification(identity, text);
    return;
  }

  waSetSession(identity.key, "AWAITING_EMAIL", {});
  waSendText(identity.replyTo,
    "Olá! Este é o atendimento do *TUIG*.\n\nComo é seu primeiro acesso por este WhatsApp, informe o mesmo e-mail cadastrado no sistema. Enviaremos um código de confirmação para ele."
  );
}

function waStartEmailVerification(identity, rawEmail) {
  const email = rawEmail.toString().toLowerCase().trim();
  const user = waGetUserRecordByEmail(email);
  if (!user) {
    waSetSession(identity.key, "AWAITING_EMAIL", {});
    waSendText(identity.replyTo,
      "Não encontrei esse e-mail entre os usuários ativos. Confira a digitação ou procure a administração do TUIG."
    );
    return;
  }

  const cache = CacheService.getScriptCache();
  const cooldownKey = "wa_otp_cooldown_" + waHash(identity.key + ":" + email);
  if (cache.get(cooldownKey)) {
    waSendText(identity.replyTo, "Aguarde um minuto antes de solicitar outro código.");
    return;
  }

  const code = waGenerateOtp();
  const expiresAt = new Date().getTime() + WA_OTP_TTL_MS;
  const codeHash = waHash(code + ":" + identity.key + ":" + waGetConfig().webhookSecret);

  MailApp.sendEmail({
    to: email,
    subject: "Código de acesso ao WhatsApp do TUIG",
    name: "TUIG",
    body: "Seu código de confirmação é " + code + ". Ele expira em 10 minutos. Se você não solicitou, ignore esta mensagem.",
    htmlBody:
      "<p>Olá, " + waEscapeHtml(user.nome) + ".</p>" +
      "<p>Seu código de confirmação do WhatsApp do TUIG é:</p>" +
      "<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">" + code + "</p>" +
      "<p>Ele expira em 10 minutos. Se você não solicitou, ignore esta mensagem.</p>"
  });
  cache.put(cooldownKey, "1", 60);

  waSetSession(identity.key, "AWAITING_CODE", {
    email: email,
    codeHash: codeHash,
    expiresAt: expiresAt,
    attempts: 0
  });

  waSendText(identity.replyTo,
    "Enviei um código de seis dígitos para *" + waMaskEmail(email) + "*. Responda somente com o código. Ele expira em 10 minutos."
  );
}

function waVerifyOtp(identity, session, command) {
  const data = session.data || {};
  const now = new Date().getTime();
  if (!data.expiresAt || now > Number(data.expiresAt)) {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "O código expirou. Envie seu e-mail novamente para gerar outro.");
    return;
  }

  if (!/^\d{6}$/.test(command)) {
    waSendText(identity.replyTo, "O código deve conter exatamente seis números.");
    return;
  }

  const expected = data.codeHash;
  const received = waHash(command + ":" + identity.key + ":" + waGetConfig().webhookSecret);
  if (!waSafeEquals(expected, received)) {
    const attempts = Number(data.attempts || 0) + 1;
    if (attempts >= WA_MAX_OTP_ATTEMPTS) {
      waClearSession(identity.key);
      waSendText(identity.replyTo, "Muitas tentativas incorretas. Envie seu e-mail novamente para gerar outro código.");
      return;
    }
    data.attempts = attempts;
    waSetSession(identity.key, "AWAITING_CODE", data);
    waSendText(identity.replyTo, "Código incorreto. Restam " + (WA_MAX_OTP_ATTEMPTS - attempts) + " tentativa(s).");
    return;
  }

  const link = waUpsertLinkedUser(data.email, identity);
  waClearSession(identity.key);
  waSendText(identity.replyTo, "Acesso confirmado. Bem-vindo(a), *" + link.nome + "*! 🎉");
  waSendMainMenu(identity.replyTo, link.email);
}

// ==========================================
// MENUS E CONSULTAS
// ==========================================

function waSendMainMenu(phone, email) {
  const user = waGetUserRecordByEmail(email);
  const isAdmin = user && (user.role === "admin" || user.role === "master_admin");
  let message =
    "*MENU TUIG*\n\n" +
    "1. 📍 Marcar presença\n" +
    "2. 👤 Meus dados\n" +
    "3. 📅 Histórico de presença\n" +
    "4. 🔮 Rituais\n" +
    "5. 💳 Mensalidades\n" +
    "6. 📝 Justificar falta\n" +
    "7. 🎓 Cursos\n" +
    "8. 📚 Biblioteca";
  if (isAdmin) message += "\n9. 🛠️ Painel administrativo";
  message +=
    "\n\nResponda com o número desejado. A qualquer momento, digite *MENU* ou *CANCELAR*.";
  waSendText(phone, message);
}

function waShowMyData(phone, email) {
  const data = getUserData(email);
  if (!data || !data.user) {
    waSendText(phone, "Não consegui localizar seus dados.");
    return;
  }
  const user = data.user;
  let message =
    "*👤 MEUS DADOS*\n\n" +
    "Nome: " + user.nome + "\n" +
    "E-mail: " + user.email + "\n" +
    "Turma: " + (user.turma || "Não informada") + "\n" +
    "Cursos/áreas: " + ((user.cursos || []).join(", ") || "Nenhum") + "\n\n" +
    "Frequência: " + (data.frequencyStats ? data.frequencyStats.percentage : 0) + "%\n" +
    "Presença hoje: " + (data.presenceToday ? "Confirmada" : "Não registrada") + "\n" +
    "Próximo ritual: " + (data.tempoParaProximo || "Nenhum agendado");
  waSendText(phone, message);
}

function waShowHistory(phone, email) {
  const data = getUserData(email);
  const history = data && data.eventHistory ? data.eventHistory.slice(0, 10) : [];
  if (!history.length) {
    waSendText(phone, "Nenhum evento foi encontrado no seu histórico.");
    return;
  }
  let message = "*📅 ÚLTIMOS EVENTOS*\n";
  history.forEach(function (event) {
    const icon = event.status === "Presente" ? "✅" : (event.status === "Abono" ? "🟡" : "❌");
    message += "\n" + icon + " " + event.data + " — " + event.nome + "\n" + event.status;
  });
  if (data.frequencyStats) {
    message += "\n\nFrequência geral: *" + data.frequencyStats.percentage + "%*";
  }
  waSendText(phone, message);
}

function waShowRituals(phone, email) {
  const data = getUserData(email);
  const rituals = data && data.rituals ? data.rituals.slice(0, 8) : [];
  let message = "*🔮 RITUAIS*\n\nPróximo: " + (data && data.tempoParaProximo ? data.tempoParaProximo : "Nenhum agendado");
  if (!rituals.length) {
    message += "\n\nNenhum ritual realizado foi encontrado.";
  } else {
    message += "\n\n*Últimos registros:*";
    rituals.forEach(function (ritual) {
      const date = new Date(ritual.data);
      const dateText = isNaN(date.getTime()) ? ritual.data : Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
      message += "\n• " + ritual.nome + " — " + dateText;
    });
  }
  waSendText(phone, message);
}

function waShowPayments(phone, email) {
  const data = getUserData(email);
  const payments = data && data.payments ? data.payments : {};
  let message = "*💳 MENSALIDADES " + new Date().getFullYear() + "*\n";
  WA_MONTHS.forEach(function (month) {
    const payment = payments[month];
    const status = payment && payment.status ? payment.status : "Em Aberto";
    const icon = status === "Aprovado" || status === "Pago" ? "✅" : (status === "Pendente" ? "🟡" : "⚪");
    message += "\n" + icon + " " + month + ": " + status;
  });
  message += "\n\nPara enviar um arquivo, escreva *COMPROVANTE MÊS*. Você poderá adicionar uma observação antes de anexar o arquivo.\nExemplo: *COMPROVANTE AGOSTO*";
  waSendText(phone, message);
}

function waShowAdminSummary(phone, email) {
  if (!waIsAdmin(email)) {
    waSendText(phone, "Acesso negado.");
    return;
  }
  const stats = getDashboardStats();
  const alerts = stats.ranking && stats.ranking.maisDeTresFaltas ? stats.ranking.maisDeTresFaltas : [];
  let message =
    "*🛠️ RESUMO ADMINISTRATIVO*\n\n" +
    "Médiuns ativos: " + stats.kpis.totalMediuns + "\n" +
    "Assiduidade geral: " + stats.kpis.assiduidadeGeral + "%\n" +
    "Turma de sexta: " + stats.barChart.sexta + "%\n" +
    "Turma de sábado: " + stats.barChart.sabado + "%\n" +
    "Turma de domingo: " + (stats.barChart.domingo || 0) + "%\n" +
    "Mais de três faltas: " + alerts.length;
  if (alerts.length) {
    message += "\n\n*Primeiros alertas:*";
    alerts.slice(0, 8).forEach(function (item) {
      message += "\n• " + item.nome + ": " + item.faltas + " faltas";
    });
  }
  message += "\n\nDigite *ADMIN* para voltar ao painel administrativo.";
  waSendText(phone, message);
}

// ==========================================
// PAINEL ADMINISTRATIVO CONVERSACIONAL
// ==========================================

function waSendAdminMenu(phone, email) {
  if (!waIsAdmin(email)) {
    waSendText(phone, "Acesso negado.");
    return;
  }
  const role = getUserRole(email);
  let message =
    "*🛠️ PAINEL ADMINISTRATIVO*\n\n" +
    "A1. Resumo e alertas\n" +
    "A2. Consultar médium\n" +
    "A3. Chamada por data\n" +
    "A4. Presenças por médium\n" +
    "A5. Financeiro pendente\n" +
    "A6. Justificativas pendentes\n" +
    "A7. Biblioteca\n" +
    "A8. Relatório de rituais\n" +
    "A9. Status da integração";
  if (role !== "master_admin") {
    message += "\n\nO relatório completo de rituais (A8) é restrito ao master_admin.";
  }
  message += "\n\nResponda com o código. Digite *MENU* para voltar ao menu pessoal.";
  waSendText(phone, message);
}

function waHandleAdminMenuCommand(identity, link, command) {
  if (!waRequireAdmin(identity, link)) return;
  switch (command) {
    case "PAINEL":
      waSendAdminMenu(identity.replyTo, link.email);
      return;
    case "A1":
      waShowAdminSummary(identity.replyTo, link.email);
      return;
    case "A2":
      waSetSession(identity.key, "AWAITING_ADMIN_USER_SEARCH", {});
      waSendText(identity.replyTo, "Digite parte do *nome ou e-mail* do médium que deseja consultar.");
      return;
    case "A3":
      waSetSession(identity.key, "AWAITING_ADMIN_BULK_DATE", {});
      waSendText(identity.replyTo,
        "Informe a data e, opcionalmente, a turma.\n\nExemplos:\n*15/08/2026*\n*15/08/2026 SEXTA*\n*15/08/2026 SÁBADO*"
      );
      return;
    case "A4":
      waSetSession(identity.key, "AWAITING_ADMIN_MEDIUM_SEARCH", {});
      waSendText(identity.replyTo, "Digite parte do *nome ou e-mail* do médium para corrigir presenças passadas.");
      return;
    case "A5":
      waAdminShowPendingPayments(identity, link);
      return;
    case "A6":
      waAdminShowPendingJustifications(identity, link);
      return;
    case "A7":
      waAdminShowLibrary(identity, link);
      return;
    case "A8":
      waAdminStartRitualReport(identity, link);
      return;
    case "A9":
      waAdminShowIntegrationStatus(identity, link);
      return;
  }
}

function waRequireAdmin(identity, link) {
  if (link && waIsAdmin(link.email)) return true;
  if (identity && identity.replyTo) waSendText(identity.replyTo, "Acesso negado.");
  return false;
}

function waAdminSearchUser(identity, link, text) {
  if (!waRequireAdmin(identity, link)) return;
  const query = waNormalizeCommand(text);
  if (query.length < 2) {
    waSendText(identity.replyTo, "Digite ao menos dois caracteres do nome ou e-mail.");
    return;
  }
  const users = getAdminData(link.email).filter(function (user) {
    return waNormalizeCommand(user.nome).indexOf(query) !== -1 || waNormalizeCommand(user.email).indexOf(query) !== -1;
  }).slice(0, WA_MAX_MENU_ITEMS);
  if (!users.length) {
    waSendText(identity.replyTo, "Nenhum médium encontrado no seu escopo. Tente outro nome ou digite *CANCELAR*.");
    return;
  }
  let message = "*MÉDIUNS ENCONTRADOS*\n";
  users.forEach(function (user, index) {
    message += "\nM" + (index + 1) + ". " + user.nome + " — " + user.email;
  });
  message += "\n\nResponda com o código, por exemplo *M1*.";
  waSetSession(identity.key, "AWAITING_ADMIN_USER_SELECTION", { users: users });
  waSendText(identity.replyTo, message);
}

function waAdminSelectUser(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const match = command.match(/^M(\d+)$/);
  const users = session.data.users || [];
  const user = match ? users[parseInt(match[1], 10) - 1] : null;
  if (!user) {
    waSendText(identity.replyTo, "Use um dos códigos apresentados, como *M1*, ou digite *CANCELAR*.");
    return;
  }
  const data = getUserData(user.email);
  if (!data) {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "Não foi possível consultar esse cadastro.");
    return;
  }
  const lastEvents = (data.eventHistory || []).slice(0, 5);
  let message =
    "*👤 " + user.nome + "*\n" +
    "E-mail: " + user.email + "\n" +
    "Turma: " + (user.turma || "Não informada") + "\n" +
    "Cursos/áreas: " + ((user.cursos || []).join(", ") || "Nenhum") + "\n" +
    "Frequência: " + data.frequencyStats.percentage + "% (" + data.frequencyStats.present + "/" + data.frequencyStats.total + ")\n" +
    "Próximo ritual: " + data.tempoParaProximo;
  if (lastEvents.length) {
    message += "\n\n*Últimos eventos:*";
    lastEvents.forEach(function (event) {
      message += "\n• " + event.data + " — " + event.status;
    });
  }
  waClearSession(identity.key);
  message += "\n\nDigite *ADMIN* para voltar ao painel.";
  waSendText(identity.replyTo, message);
}

function waAdminLoadBulkDate(identity, link, text) {
  if (!waRequireAdmin(identity, link)) return;
  const parsed = waParseAdminDateInput(text);
  if (!parsed) {
    waSendText(identity.replyTo, "Formato inválido. Use *DD/MM/AAAA* e, se quiser, acrescente *SEXTA* ou *SÁBADO*.");
    return;
  }
  if (parsed.date.getTime() > new Date().getTime()) {
    waSendText(identity.replyTo, "A chamada administrativa só pode ser feita para hoje ou para uma data passada.");
    return;
  }
  const result = waParseTextOutput(handleGetBulkPresenceList(parsed.isoDate, parsed.turma));
  const missing = (result.data || []).filter(function (user) { return !user.isPresent; }).slice(0, WA_MAX_MENU_ITEMS);
  if (!missing.length) {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "Todos os médiuns desse filtro já possuem presença nessa data.");
    return;
  }
  let message = "*CHAMADA — " + parsed.displayDate + "*\nAusentes no filtro " + parsed.turma + ":";
  missing.forEach(function (user, index) {
    message += "\nP" + (index + 1) + ". " + user.nome + " — " + (user.turma || "sem turma");
  });
  message += "\n\nResponda *P1,3,5* para selecionar ou *TODOS* para os nomes exibidos.";
  waSetSession(identity.key, "AWAITING_ADMIN_BULK_SELECTION", {
    date: parsed.isoDate,
    displayDate: parsed.displayDate,
    users: missing
  });
  waSendText(identity.replyTo, message);
}

function waAdminSelectBulkPresence(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const users = session.data.users || [];
  const selected = waSelectCodedItems(command, "P", users);
  if (!selected.length) {
    waSendText(identity.replyTo, "Seleção inválida. Exemplo: *P1,3* ou *TODOS*.");
    return;
  }
  waPrepareAdminConfirmation(identity, "BULK_DATE", {
    date: session.data.date,
    adminEmail: link.email,
    presences: selected.map(function (user) {
      return { email: user.email, nome: user.nome, isPresent: true };
    })
  }, "registrar " + selected.length + " presença(s) em " + session.data.displayDate);
}

function waAdminSearchMediumForPresence(identity, link, text) {
  if (!waRequireAdmin(identity, link)) return;
  const query = waNormalizeCommand(text);
  const users = getAdminData(link.email).filter(function (user) {
    return waNormalizeCommand(user.nome).indexOf(query) !== -1 || waNormalizeCommand(user.email).indexOf(query) !== -1;
  }).slice(0, WA_MAX_MENU_ITEMS);
  if (query.length < 2 || !users.length) {
    waSendText(identity.replyTo, "Nenhum médium encontrado. Digite ao menos dois caracteres ou *CANCELAR*.");
    return;
  }
  let message = "*SELECIONE O MÉDIUM*\n";
  users.forEach(function (user, index) { message += "\nM" + (index + 1) + ". " + user.nome; });
  waSetSession(identity.key, "AWAITING_ADMIN_MEDIUM_SELECTION", { users: users });
  waSendText(identity.replyTo, message);
}

function waAdminSelectMediumForPresence(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const match = command.match(/^M(\d+)$/);
  const medium = match ? (session.data.users || [])[parseInt(match[1], 10) - 1] : null;
  if (!medium) {
    waSendText(identity.replyTo, "Use um dos códigos apresentados, como *M1*.");
    return;
  }
  const result = waParseTextOutput(handleGetBulkPresenceListByMedium(medium.email));
  const dates = result.data && result.data.dates
    ? result.data.dates.filter(function (item) { return !item.isPresent; }).slice(0, WA_MAX_MENU_ITEMS)
    : [];
  if (!dates.length) {
    waClearSession(identity.key);
    waSendText(identity.replyTo, medium.nome + " não possui datas ausentes disponíveis para correção.");
    return;
  }
  let message = "*PRESENÇAS DE " + medium.nome.toUpperCase() + "*\nSelecione as datas:";
  dates.forEach(function (item, index) {
    message += "\nD" + (index + 1) + ". " + item.dateStr + " — " + item.turma;
  });
  message += "\n\nExemplo: *D1,2* ou *TODOS*.";
  waSetSession(identity.key, "AWAITING_ADMIN_MEDIUM_DATES", { medium: medium, dates: dates });
  waSendText(identity.replyTo, message);
}

function waAdminSelectMediumDates(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const dates = waSelectCodedItems(command, "D", session.data.dates || []);
  if (!dates.length) {
    waSendText(identity.replyTo, "Seleção inválida. Exemplo: *D1,2* ou *TODOS*.");
    return;
  }
  const medium = session.data.medium;
  waPrepareAdminConfirmation(identity, "BULK_MEDIUM", {
    mediumEmail: medium.email,
    mediumNome: medium.nome,
    adminEmail: link.email,
    presences: dates
  }, "registrar " + dates.length + " presença(s) para " + medium.nome);
}

function waAdminShowPendingPayments(identity, link) {
  if (!waRequireAdmin(identity, link)) return;
  const result = waParseTextOutput(handleGetFinancialReport(link.email));
  const visibleEmails = {};
  ((result.data && result.data.users) || []).forEach(function (user) {
    visibleEmails[user.email.toLowerCase().trim()] = true;
  });
  const pending = ((result.data && result.data.pending) || []).filter(function (item) {
    return visibleEmails[item.email.toLowerCase().trim()];
  }).slice(0, WA_MAX_MENU_ITEMS);
  if (!pending.length) {
    waSendText(identity.replyTo, "Não há comprovantes pendentes no seu escopo. ✅");
    return;
  }
  let message = "*💳 COMPROVANTES PENDENTES*\n";
  pending.forEach(function (item, index) {
    message += "\nF" + (index + 1) + ". " + item.nome + " — " + item.mes + "/" + item.ano;
  });
  message += "\n\nResponda com o código, por exemplo *F1*.";
  waSetSession(identity.key, "AWAITING_ADMIN_PAYMENT_SELECTION", { pending: pending });
  waSendText(identity.replyTo, message);
}

function waAdminSelectPayment(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const match = command.match(/^F(\d+)$/);
  const payment = match ? (session.data.pending || [])[parseInt(match[1], 10) - 1] : null;
  if (!payment) {
    waSendText(identity.replyTo, "Use um dos códigos apresentados, como *F1*.");
    return;
  }
  waSetSession(identity.key, "AWAITING_ADMIN_PAYMENT_DECISION", { payment: payment });
  waSendText(identity.replyTo,
    "*" + payment.nome + " — " + payment.mes + "/" + payment.ano + "*\n" +
    "Comprovante: " + (payment.link || "sem link") + "\n" +
    "Observação: " + (payment.obsAluno || "nenhuma") +
    "\n\nResponda *APROVAR* ou *REJEITAR motivo*."
  );
}

function waAdminPreparePaymentDecision(identity, link, session, text, command) {
  if (!waRequireAdmin(identity, link)) return;
  let status = "";
  let obs = "";
  if (command === "APROVAR" || command === "A") status = "Aprovado";
  if (command.indexOf("REJEITAR") === 0 || command.indexOf("R ") === 0) {
    status = "Rejeitado";
    obs = text.replace(/^\s*(REJEITAR|R)\s*/i, "").trim();
    if (obs.length < 3) {
      waSendText(identity.replyTo, "Ao rejeitar, informe o motivo. Exemplo: *REJEITAR imagem ilegível*.");
      return;
    }
  }
  if (!status) {
    waSendText(identity.replyTo, "Responda *APROVAR* ou *REJEITAR motivo*.");
    return;
  }
  const payment = session.data.payment;
  waPrepareAdminConfirmation(identity, "PAYMENT_REVIEW", {
    adminEmail: link.email,
    studentEmail: payment.email,
    mes: payment.mes,
    ano: payment.ano,
    status: status,
    obs: obs
  }, status.toLowerCase() + " o comprovante de " + payment.nome + " — " + payment.mes + "/" + payment.ano);
}

function waAdminShowPendingJustifications(identity, link) {
  if (!waRequireAdmin(identity, link)) return;
  const pending = waGetPendingJustifications(link.email).slice(0, WA_MAX_MENU_ITEMS);
  if (!pending.length) {
    waSendText(identity.replyTo, "Não há justificativas pendentes no seu escopo. ✅");
    return;
  }
  let message = "*📝 JUSTIFICATIVAS PENDENTES*\n";
  pending.forEach(function (item, index) {
    message += "\nJ" + (index + 1) + ". " + item.nome + " — " + item.dataEvento;
  });
  message += "\n\nResponda com o código, por exemplo *J1*.";
  waSetSession(identity.key, "AWAITING_ADMIN_JUSTIFICATION_SELECTION", { pending: pending });
  waSendText(identity.replyTo, message);
}

function waAdminSelectJustification(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  const match = command.match(/^J(\d+)$/);
  const item = match ? (session.data.pending || [])[parseInt(match[1], 10) - 1] : null;
  if (!item) {
    waSendText(identity.replyTo, "Use um dos códigos apresentados, como *J1*.");
    return;
  }
  waSetSession(identity.key, "AWAITING_ADMIN_JUSTIFICATION_DECISION", { justification: item });
  waSendText(identity.replyTo,
    "*" + item.nome + " — " + item.dataEvento + "*\n" + item.motivo +
    "\n\nResponda *APROVAR* ou *REJEITAR motivo*."
  );
}

function waAdminPrepareJustificationDecision(identity, link, session, text, command) {
  if (!waRequireAdmin(identity, link)) return;
  let status = "";
  let obs = "";
  if (command === "APROVAR" || command === "A") status = "Aprovado";
  if (command.indexOf("REJEITAR") === 0 || command.indexOf("R ") === 0) {
    status = "Rejeitado";
    obs = text.replace(/^\s*(REJEITAR|R)\s*/i, "").trim();
    if (obs.length < 3) {
      waSendText(identity.replyTo, "Informe o motivo da rejeição.");
      return;
    }
  }
  if (!status) {
    waSendText(identity.replyTo, "Responda *APROVAR* ou *REJEITAR motivo*.");
    return;
  }
  const item = session.data.justification;
  waPrepareAdminConfirmation(identity, "JUSTIFICATION_REVIEW", {
    rowIndex: item.rowIndex,
    email: item.email,
    dataEvento: item.dataEvento,
    adminEmail: link.email,
    status: status,
    obs: obs
  }, status.toLowerCase() + " a justificativa de " + item.nome + " — " + item.dataEvento);
}

function waAdminShowLibrary(identity, link) {
  if (!waRequireAdmin(identity, link)) return;
  const result = waParseTextOutput(handleGetBooksData(link.email));
  if (result.status !== "success") {
    waSendText(identity.replyTo, result.message || "Não foi possível consultar a biblioteca.");
    return;
  }
  const pickups = (result.loans || []).filter(function (loan) { return loan.status === "Solicitado"; }).slice(0, WA_MAX_MENU_ITEMS);
  const returns = (result.loans || []).filter(function (loan) { return loan.status === "Ativo" || loan.status === "Atrasado"; }).slice(0, WA_MAX_MENU_ITEMS);
  const books = (result.books || []).slice(0, WA_MAX_MENU_ITEMS);
  let message = "*📚 GESTÃO DA BIBLIOTECA*\n";
  if (pickups.length) {
    message += "\n*Retiradas pendentes:*";
    pickups.forEach(function (loan, index) { message += "\nT" + (index + 1) + ". " + loan.nome + " — " + loan.tituloLivro; });
  }
  if (returns.length) {
    message += "\n\n*Devoluções:*";
    returns.forEach(function (loan, index) { message += "\nD" + (index + 1) + ". " + loan.nome + " — " + loan.tituloLivro + " (" + loan.status + ")"; });
  }
  if (books.length) {
    message += "\n\n*Livros:*";
    books.forEach(function (book, index) { message += "\nL" + (index + 1) + ". " + book.titulo + " — " + book.qtdDisponivel + "/" + book.qtdTotal; });
  }
  message +=
    "\n\nUse *T1* para confirmar retirada, *D1* para devolução ou *X1* para excluir um livro." +
    "\nPara cadastrar: *NOVO | Título | Autor | Quantidade | Categoria | Localização*." +
    "\nPara editar: *EDITAR L1 | Título | Autor | Quantidade | Categoria | Localização*.";
  waSetSession(identity.key, "AWAITING_ADMIN_LIBRARY_ACTION", { pickups: pickups, returns: returns, books: books });
  waSendText(identity.replyTo, message);
}

function waAdminHandleLibraryAction(identity, link, session, text, command) {
  if (!waRequireAdmin(identity, link)) return;
  let match = command.match(/^T(\d+)$/);
  if (match) {
    const loan = (session.data.pickups || [])[parseInt(match[1], 10) - 1];
    if (!loan) return waSendText(identity.replyTo, "Código de retirada inválido.");
    waPrepareAdminConfirmation(identity, "BOOK_PICKUP", { loanId: loan.id, adminEmail: link.email }, "confirmar a retirada de " + loan.tituloLivro + " por " + loan.nome);
    return;
  }
  match = command.match(/^D(\d+)$/);
  if (match) {
    const loan = (session.data.returns || [])[parseInt(match[1], 10) - 1];
    if (!loan) return waSendText(identity.replyTo, "Código de devolução inválido.");
    waPrepareAdminConfirmation(identity, "BOOK_RETURN", { loanId: loan.id, adminEmail: link.email }, "confirmar a devolução de " + loan.tituloLivro + " por " + loan.nome);
    return;
  }
  match = command.match(/^X(\d+)$/);
  if (match) {
    const book = (session.data.books || [])[parseInt(match[1], 10) - 1];
    if (!book) return waSendText(identity.replyTo, "Código de livro inválido.");
    waPrepareAdminConfirmation(identity, "BOOK_DELETE", { id: book.id, adminEmail: link.email }, "excluir o livro " + book.titulo);
    return;
  }
  const parts = text.split("|").map(function (part) { return part.trim(); });
  if (waNormalizeCommand(parts[0]) === "NOVO" && parts.length >= 4) {
    const bookData = waBookDataFromParts(parts.slice(1), null, link.email);
    if (!bookData) return waSendText(identity.replyTo, "Quantidade inválida. Use um número inteiro maior que zero.");
    waPrepareAdminConfirmation(identity, "BOOK_SAVE", bookData, "cadastrar o livro " + bookData.titulo);
    return;
  }
  const editMatch = parts[0] ? waNormalizeCommand(parts[0]).match(/^EDITAR L(\d+)$/) : null;
  if (editMatch && parts.length >= 4) {
    const book = (session.data.books || [])[parseInt(editMatch[1], 10) - 1];
    if (!book) return waSendText(identity.replyTo, "Código de livro inválido.");
    const bookData = waBookDataFromParts(parts.slice(1), book, link.email);
    if (!bookData) return waSendText(identity.replyTo, "Quantidade inválida. Use um número inteiro maior que zero.");
    waPrepareAdminConfirmation(identity, "BOOK_SAVE", bookData, "editar o livro " + book.titulo);
    return;
  }
  waSendText(identity.replyTo, "Comando inválido. Use um dos códigos apresentados ou o formato *NOVO | ...*.");
}

function waBookDataFromParts(parts, existing, adminEmail) {
  const quantity = parseInt(parts[2], 10);
  if (!parts[0] || !isFinite(quantity) || quantity < 1) return null;
  return {
    id: existing ? existing.id : "",
    titulo: parts[0],
    autor: parts[1] || "",
    qtdTotal: quantity,
    categoria: parts[3] || (existing && existing.categoria) || "Geral",
    localizacao: parts[4] || (existing && existing.localizacao) || "",
    sinopse: existing ? existing.sinopse : "",
    capaUrl: existing ? existing.capaUrl : "",
    adminEmail: adminEmail
  };
}

function waAdminStartRitualReport(identity, link) {
  if (!waRequireAdmin(identity, link)) return;
  if (getUserRole(link.email) !== "master_admin") {
    waSendText(identity.replyTo, "O relatório completo de rituais é restrito ao master_admin.");
    return;
  }
  const result = waParseTextOutput(handleGetRitualsReport(link.email));
  if (result.status !== "success") {
    waSendText(identity.replyTo, result.message || "Não foi possível gerar o relatório.");
    return;
  }
  const users = result.data.users || [];
  const total = users.reduce(function (sum, user) { return sum + (user.rituals || []).length; }, 0);
  waSetSession(identity.key, "AWAITING_ADMIN_RITUAL_SEARCH", { users: users });
  waSendText(identity.replyTo,
    "*🔮 RELATÓRIO DE RITUAIS*\n\nMédiuns: " + users.length + "\nRegistros: " + total +
    "\nTipos cadastrados: " + (result.data.uniqueRituals || []).length +
    "\n\nDigite parte do nome ou e-mail para consultar um médium."
  );
}

function waAdminSearchRitualReport(identity, link, session, text) {
  if (!waRequireAdmin(identity, link)) return;
  const query = waNormalizeCommand(text);
  const users = (session.data.users || []).filter(function (user) {
    return waNormalizeCommand(user.nome).indexOf(query) !== -1 || waNormalizeCommand(user.email).indexOf(query) !== -1;
  }).slice(0, 5);
  if (query.length < 2 || !users.length) {
    waSendText(identity.replyTo, "Nenhum médium encontrado. Tente outro nome ou digite *CANCELAR*.");
    return;
  }
  let message = "*RITUAIS ENCONTRADOS*";
  users.forEach(function (user) {
    message += "\n\n*" + user.nome + "* — " + user.email;
    const rituals = (user.rituals || []).slice(0, 8);
    if (!rituals.length) message += "\nNenhum ritual registrado.";
    rituals.forEach(function (ritual) {
      const date = new Date(ritual.data);
      const dateText = isNaN(date.getTime()) ? ritual.data : Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
      message += "\n• " + ritual.nome + " — " + dateText;
    });
  });
  message += "\n\nDigite outro nome, *CANCELAR* ou *ADMIN*.";
  waSendText(identity.replyTo, message);
}

function waAdminShowIntegrationStatus(identity, link) {
  if (!waRequireAdmin(identity, link)) return;
  const props = PropertiesService.getScriptProperties();
  const activatedAt = Number(props.getProperty("WAPI_WEBHOOK_ACTIVATED_AT") || 0);
  const message =
    "*⚙️ STATUS DA INTEGRAÇÃO*\n\n" +
    "Instância: " + (props.getProperty("WAPI_INSTANCE_ID") ? "✅ configurada" : "❌ ausente") + "\n" +
    "Token: " + (props.getProperty("WAPI_TOKEN") ? "✅ configurado" : "❌ ausente") + "\n" +
    "Segredo: " + (props.getProperty("WAPI_WEBHOOK_SECRET") ? "✅ configurado" : "❌ ausente") + "\n" +
    "URL /exec: " + (props.getProperty("WAPI_WEBHOOK_URL") ? "✅ configurada" : "❌ ausente") + "\n" +
    "Webhook ativado em: " + (activatedAt ? Utilities.formatDate(new Date(activatedAt), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : "não ativado") +
    "\nAPI web legada: " + (props.getProperty("TUIG_ENABLE_LEGACY_WEB_API") === "true" ? "⚠️ ativa" : "✅ desativada");
  waSendText(identity.replyTo, message);
}

function waPrepareAdminConfirmation(identity, operation, payload, summary) {
  waSetSession(identity.key, "AWAITING_ADMIN_CONFIRMATION", {
    operation: operation,
    payload: payload,
    summary: summary
  });
  waSendText(identity.replyTo,
    "*CONFIRMAÇÃO OBRIGATÓRIA*\n\nVocê está prestes a " + summary + ".\n\nResponda *CONFIRMAR* para executar ou *CANCELAR* para desistir."
  );
}

function waAdminConfirmOperation(identity, link, session, command) {
  if (!waRequireAdmin(identity, link)) return;
  if (command !== "CONFIRMAR") {
    waSendText(identity.replyTo, "Responda exatamente *CONFIRMAR* ou *CANCELAR*.");
    return;
  }
  const operation = session.data.operation;
  const payload = session.data.payload || {};
  const result = waCallLocked(function () {
    if (operation === "BULK_DATE") return waParseTextOutput(saveBulkPresenceLocked(payload));
    if (operation === "BULK_MEDIUM") return waParseTextOutput(saveBulkPresenceByMediumLocked(payload));
    if (operation === "PAYMENT_REVIEW") return waParseTextOutput(handleVerifyPayment(payload));
    if (operation === "JUSTIFICATION_REVIEW") return waReviewJustification(payload);
    if (operation === "BOOK_PICKUP") return waParseTextOutput(handleConfirmBookPickup(payload));
    if (operation === "BOOK_RETURN") return waParseTextOutput(handleConfirmBookReturn(payload));
    if (operation === "BOOK_DELETE") return waParseTextOutput(handleDeleteBook(payload));
    if (operation === "BOOK_SAVE") return waParseTextOutput(handleSaveBook(payload));
    return { status: "error", message: "Operação administrativa desconhecida." };
  });

  waAuditAdminAction(link.email, operation, payload, result);
  waClearSession(identity.key);
  waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + (result.message || "Operação concluída."));
  waSendAdminMenu(identity.replyTo, link.email);
}

function waGetPendingJustifications(adminEmail) {
  const visible = {};
  getAdminData(adminEmail).forEach(function (user) { visible[user.email.toLowerCase().trim()] = true; });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(NOME_ABA_JUSTIFICATIVAS);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const pending = [];
  for (let i = 1; i < values.length; i++) {
    const email = values[i][1] ? values[i][1].toString().toLowerCase().trim() : "";
    const status = values[i][4] ? waNormalizeCommand(values[i][4]) : "";
    if (visible[email] && status === "PENDENTE") {
      const rawDate = values[i][0];
      pending.push({
        rowIndex: i + 1,
        dataEvento: rawDate instanceof Date ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MM/yyyy") : rawDate.toString(),
        email: email,
        nome: values[i][2] ? values[i][2].toString() : email,
        motivo: values[i][3] ? values[i][3].toString() : ""
      });
    }
  }
  return pending.reverse();
}

function waReviewJustification(data) {
  if (!data || !data.rowIndex || !data.adminEmail || !waIsAdmin(data.adminEmail)) {
    return { status: "error", message: "Acesso negado ou dados incompletos." };
  }
  const visible = {};
  getAdminData(data.adminEmail).forEach(function (user) { visible[user.email.toLowerCase().trim()] = true; });
  if (!visible[data.email.toLowerCase().trim()]) {
    return { status: "error", message: "Essa justificativa não pertence ao seu escopo administrativo." };
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(NOME_ABA_JUSTIFICATIVAS);
  if (!sheet || data.rowIndex < 2 || data.rowIndex > sheet.getLastRow()) {
    return { status: "error", message: "Justificativa não encontrada." };
  }
  const row = sheet.getRange(data.rowIndex, 1, 1, Math.max(5, sheet.getLastColumn())).getValues()[0];
  const rowEmail = row[1] ? row[1].toString().toLowerCase().trim() : "";
  const rowStatus = row[4] ? waNormalizeCommand(row[4]) : "";
  if (rowEmail !== data.email.toLowerCase().trim() || rowStatus !== "PENDENTE") {
    return { status: "error", message: "A justificativa já foi revisada ou mudou desde a seleção." };
  }
  if (sheet.getLastColumn() < 8) {
    sheet.getRange(1, 6, 1, 3).setValues([["Revisado por", "Revisado em", "Observação admin"]]).setFontWeight("bold");
  }
  sheet.getRange(data.rowIndex, 5, 1, 4).setValues([[
    data.status,
    data.adminEmail,
    new Date(),
    data.obs || ""
  ]]);
  return { status: "success", message: "Justificativa atualizada para " + data.status + "." };
}

function waAuditAdminAction(adminEmail, operation, payload, result) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_EVENTS_SHEET, [
      "Chave", "Recebido em", "Evento", "Remetente", "Status", "Erro"
    ]);
    const safePayload = Object.assign({}, payload || {});
    delete safePayload.fileBase64;
    sheet.appendRow([
      "ADMIN-" + Utilities.getUuid(),
      new Date(),
      operation,
      adminEmail,
      result && result.status === "success" ? "Concluído" : "Erro",
      JSON.stringify({ payload: safePayload, message: result && result.message })
    ]);
  } catch (error) {
    console.error("Falha ao auditar operação administrativa: " + error.toString());
  }
}

// ==========================================
// PRESENÇA
// ==========================================

function waStartPresence(identity, link) {
  const data = getUserData(link.email);
  if (!data) {
    waSendText(identity.replyTo, "Não consegui consultar sua situação de presença.");
    return;
  }
  if (data.presenceToday) {
    waSendText(identity.replyTo, "Sua presença de hoje já está registrada. ✅");
    return;
  }
  if (!data.canMarkPresence) {
    waSendText(identity.replyTo, data.blockReason || "A presença não está disponível neste horário.");
    return;
  }
  waSetSession(identity.key, "AWAITING_PRESENCE_LOCATION", {});
  waSendText(identity.replyTo,
    "Para marcar a presença, use o clipe do WhatsApp, escolha *Localização* e envie sua localização atual.\n\nNão envie apenas o endereço em texto."
  );
}

function waRegisterPresenceFromLocation(identity, link, location) {
  const result = waCallLocked(function () {
    return registerPresenceLocked({
      studentEmail: link.email,
      registeredBy: "WhatsApp: " + link.email,
      lat: location.latitude,
      lon: location.longitude,
      deviceId: "WA-" + waHash(identity.key).substring(0, 16).toUpperCase()
    });
  });
  waClearSession(identity.key);
  const prefix = result.status === "success" ? "✅ " : "⚠️ ";
  waSendText(identity.replyTo, prefix + (result.message || "Operação concluída."));
}

// ==========================================
// JUSTIFICATIVAS
// ==========================================

function waStartJustification(identity, link) {
  const data = getUserData(link.email);
  const options = (data && data.eventHistory ? data.eventHistory : [])
    .filter(function (event) {
      return event.status === "Ausente" && waIsJustificationAllowed(event.rawDate);
    })
    .slice(0, 9)
    .map(function (event) {
      return { data: event.data, nome: event.nome };
    });

  if (!options.length) {
    waSendText(identity.replyTo, "Não há faltas dentro do prazo de justificativa.");
    return;
  }

  let message = "*📝 JUSTIFICAR FALTA*\n\nEscolha o evento:";
  options.forEach(function (option, index) {
    message += "\n" + (index + 1) + ". " + option.data + " — " + option.nome;
  });
  message += "\n\nResponda somente com o número, ou digite *CANCELAR*.";
  waSetSession(identity.key, "AWAITING_JUSTIFICATION_SELECTION", { options: options });
  waSendText(identity.replyTo, message);
}

function waSelectJustification(identity, link, session, command) {
  const options = session.data && session.data.options ? session.data.options : [];
  const index = parseInt(command, 10) - 1;
  if (isNaN(index) || index < 0 || index >= options.length) {
    waSendText(identity.replyTo, "Escolha um dos números apresentados, ou digite *CANCELAR*.");
    return;
  }
  const selected = options[index];
  waSetSession(identity.key, "AWAITING_JUSTIFICATION_REASON", { selected: selected });
  waSendText(identity.replyTo,
    "Explique resumidamente o motivo da ausência em *" + selected.data + "*. Sua justificativa ficará pendente de avaliação."
  );
}

function waSubmitJustification(identity, link, session, text) {
  const reason = text.trim();
  if (reason.length < 5) {
    waSendText(identity.replyTo, "Informe um motivo com pelo menos cinco caracteres.");
    return;
  }
  if (reason.length > 1000) {
    waSendText(identity.replyTo, "O motivo está muito longo. Resuma em até 1000 caracteres.");
    return;
  }
  const selected = session.data.selected;
  const result = waParseTextOutput(handleSendJustification({
    email: link.email,
    nome: link.nome,
    motivo: reason,
    dataEvento: selected.data
  }));
  waClearSession(identity.key);
  waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + result.message);
}

function waIsJustificationAllowed(rawDate) {
  if (!rawDate) return false;
  const eventDate = new Date(rawDate);
  if (isNaN(eventDate.getTime())) return false;
  const start = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 7, 0, 0, 0);
  const limit = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 12, 0, 0, 0);
  const day = limit.getDay();
  limit.setDate(limit.getDate() + (day === 0 ? 0 : 7 - day));
  limit.setHours(12, 0, 0, 0);
  const now = new Date();
  return now >= start && now <= limit;
}

// ==========================================
// COMPROVANTES E MÍDIA
// ==========================================

function waProcessPaymentReceipt(identity, link, context, media) {
  const file = waDownloadIncomingMedia(media);
  const result = waCallLocked(function () {
    return waParseTextOutput(handleUploadReceipt({
      email: link.email,
      nome: link.nome,
      mes: context.mes,
      ano: context.ano || new Date().getFullYear(),
      fileBase64: file.dataUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
      obs: waBuildPaymentObservation(context.obs)
    }));
  });
  waClearSession(identity.key);
  waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + result.message);
}

function waReceivePaymentObservation(identity, session, text, command) {
  const observation = command === "PULAR" ? "" : (text || "").trim();
  if (observation.length > 1000) {
    waSendText(identity.replyTo, "A observação está muito longa. Resuma em até 1000 caracteres ou digite *PULAR*.");
    return;
  }
  const context = session.data || {};
  context.obs = observation;
  waSetSession(identity.key, "AWAITING_PAYMENT_MEDIA", context);
  waSendText(identity.replyTo,
    "Agora envie a imagem ou o PDF do comprovante de *" + context.mes + "*.\n\nO arquivo deve ter no máximo 5 MB. Digite *CANCELAR* para cancelar."
  );
}

function waBuildPaymentObservation(observation) {
  const text = (observation || "").trim();
  return text ? "Enviado pelo WhatsApp\nObservação: " + text : "Enviado pelo WhatsApp";
}

function waDownloadIncomingMedia(media) {
  if (!media || (!media.mediaKey && !media.mediaId) || (!media.directPath && !media.mediaId)) {
    throw new Error("A mensagem não contém os dados necessários para baixar a mídia.");
  }

  const allowedMime = /^image\/(jpeg|jpg|png|webp)$|^application\/pdf$/i;
  const mimeType = media.mimetype || "application/octet-stream";
  if (!allowedMime.test(mimeType)) {
    throw new Error("Envie apenas imagem JPG/PNG/WEBP ou arquivo PDF.");
  }

  const config = waGetConfig();
  let response;
  if (config.provider === "meta") {
    const metadata = waMetaDownloadMedia(media.mediaId);
    if (!metadata || !metadata.url) throw new Error("A API oficial Meta não disponibilizou o arquivo recebido.");
    response = UrlFetchApp.fetch(metadata.url, {
      headers: { Authorization: "Bearer " + config.accessToken },
      muteHttpExceptions: true
    });
  } else {
    const download = waWapiRequest("post", "/v1/message/download-media", {
      mediaKey: media.mediaKey,
      directPath: media.directPath,
      type: media.type,
      mimetype: mimeType
    });
    if (!download || download.error === true || !download.fileLink) {
      throw new Error("A W-API não disponibilizou o arquivo recebido.");
    }
    response = UrlFetchApp.fetch(download.fileLink, { muteHttpExceptions: true });
  }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error("Não foi possível baixar o arquivo temporário.");
  }
  const bytes = response.getBlob().getBytes();
  if (bytes.length > WA_MAX_MEDIA_BYTES) {
    throw new Error("O arquivo ultrapassa o limite de 5 MB.");
  }

  const extension = waExtensionForMime(mimeType);
  const rawName = media.fileName || ("comprovante_" + new Date().getTime() + "." + extension);
  const safeName = rawName.toString().replace(/[^a-zA-Z0-9._-]/g, "_");
  return {
    mimeType: mimeType,
    fileName: safeName,
    dataUrl: "data:" + mimeType + ";base64," + Utilities.base64Encode(bytes)
  };
}

// ==========================================
// CURSOS
// ==========================================

function waStartCourses(identity, link) {
  const result = waParseTextOutput(handleGetCoursesData(link.email));
  const data = result.data || {};
  const enrolled = {};
  (data.userEnrollments || []).forEach(function (item) {
    enrolled[waNormalizeCommand(item.curso)] = true;
  });
  const courses = (data.availableCourses || []).slice(0, 9);
  if (!courses.length) {
    waSendText(identity.replyTo, "Nenhum curso está disponível no momento.");
    return;
  }
  let message = "*🎓 CURSOS TUIG*\n";
  courses.forEach(function (course, index) {
    const isEnrolled = enrolled[waNormalizeCommand(course.nome)];
    message += "\n" + (index + 1) + ". " + course.nome + " — " + (course.valor || "Grátis");
    if (course.data) message += " — " + course.data;
    if (isEnrolled) message += " ✅ inscrito";
  });
  message += "\n\nResponda com o número para se inscrever, ou *CANCELAR*.";
  waSetSession(identity.key, "AWAITING_COURSE_SELECTION", {
    courses: courses,
    enrolled: enrolled
  });
  waSendText(identity.replyTo, message);
}

function waSelectCourse(identity, link, session, command) {
  const courses = session.data.courses || [];
  const index = parseInt(command, 10) - 1;
  if (isNaN(index) || index < 0 || index >= courses.length) {
    waSendText(identity.replyTo, "Escolha um dos números apresentados, ou digite *CANCELAR*.");
    return;
  }
  const course = courses[index];
  if (session.data.enrolled && session.data.enrolled[waNormalizeCommand(course.nome)]) {
    waClearSession(identity.key);
    waSendText(identity.replyTo, "Você já está inscrito(a) nesse curso.");
    return;
  }
  if (waIsFreeValue(course.valor)) {
    waProcessCourseEnrollment(identity, link, course, null);
    return;
  }
  waSetSession(identity.key, "AWAITING_COURSE_MEDIA", { course: course });
  waSendText(identity.replyTo,
    "O curso *" + course.nome + "* custa " + course.valor + ". Envie agora a imagem ou PDF do comprovante para efetivar a inscrição."
  );
}

function waProcessCourseEnrollment(identity, link, course, media) {
  let file = null;
  if (media) file = waDownloadIncomingMedia(media);
  const user = waGetUserRecordByEmail(link.email);
  const result = waCallLocked(function () {
    return waParseTextOutput(handleEnrollCourse({
      email: link.email,
      nome: user.nome,
      turma: user.turma,
      curso: course.nome,
      valor: course.valor,
      fileBase64: file ? file.dataUrl : null,
      fileName: file ? file.fileName : null,
      mimeType: file ? file.mimeType : null
    }));
  });
  waClearSession(identity.key);
  waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + result.message);
}

// ==========================================
// BIBLIOTECA
// ==========================================

function waStartLibrary(identity, link) {
  const result = waParseTextOutput(handleGetBooksData(link.email));
  if (result.status !== "success") {
    waSendText(identity.replyTo, result.message || "Não foi possível consultar a biblioteca.");
    return;
  }
  const books = (result.books || []).filter(function (book) {
    return Number(book.qtdDisponivel || 0) > 0;
  }).slice(0, 9);
  const loans = (result.loans || []).filter(function (loan) {
    return loan.email && loan.email.toString().toLowerCase().trim() === link.email.toLowerCase().trim() &&
      loan.status !== "Devolvido" && loan.status !== "Cancelado";
  });

  let message = "*📚 BIBLIOTECA TUIG*\n";
  if (loans.length) {
    message += "\n*Seus empréstimos:*";
    loans.forEach(function (loan, index) {
      message += "\nC" + (index + 1) + ". " + loan.tituloLivro + " — " + loan.status;
    });
    message += "\nPara cancelar uma solicitação pendente, responda C + número. Ex.: *C1*.\n";
  }
  if (books.length) {
    message += "\n*Livros disponíveis:*";
    books.forEach(function (book, index) {
      message += "\nL" + (index + 1) + ". " + book.titulo + (book.autor ? " — " + book.autor : "");
    });
    message += "\nPara solicitar, responda L + número. Ex.: *L1*.";
  } else {
    message += "\nNenhum livro está disponível no momento.";
  }
  message += "\n\nDigite *CANCELAR* para cancelar a operação.";
  waSetSession(identity.key, "AWAITING_BOOK_ACTION", { books: books, loans: loans });
  waSendText(identity.replyTo, message);
}

function waHandleBookAction(identity, link, session, command) {
  const bookMatch = command.match(/^L(\d+)$/);
  const cancelMatch = command.match(/^C(\d+)$/);
  if (bookMatch) {
    const books = session.data.books || [];
    const book = books[parseInt(bookMatch[1], 10) - 1];
    if (!book) {
      waSendText(identity.replyTo, "Livro inválido. Use um dos códigos apresentados.");
      return;
    }
    const result = waCallLocked(function () {
      return waParseTextOutput(handleRequestBookLoan({
        livroId: book.id,
        email: link.email,
        nome: link.nome
      }));
    });
    waClearSession(identity.key);
    waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + result.message);
    return;
  }
  if (cancelMatch) {
    const loans = session.data.loans || [];
    const loan = loans[parseInt(cancelMatch[1], 10) - 1];
    if (!loan || loan.status !== "Solicitado") {
      waSendText(identity.replyTo, "Somente solicitações pendentes podem ser canceladas.");
      return;
    }
    const result = waCallLocked(function () {
      return waParseTextOutput(handleCancelBookLoanRequest({
        loanId: loan.id,
        email: link.email
      }));
    });
    waClearSession(identity.key);
    waSendText(identity.replyTo, (result.status === "success" ? "✅ " : "⚠️ ") + result.message);
    return;
  }
  waSendText(identity.replyTo, "Use um código como *L1* ou *C1*, ou digite *CANCELAR*.");
}

// ==========================================
// W-API CLIENT E PARSERS
// ==========================================

function waGetConfig() {
  const props = PropertiesService.getScriptProperties();
  const provider = (props.getProperty("WHATSAPP_PROVIDER") || "wapi").toString().trim().toLowerCase();
  if (provider === "meta" || provider === "cloud" || provider === "cloud_api") {
    const meta = {
      provider: "meta",
      phoneNumberId: (props.getProperty("META_PHONE_NUMBER_ID") || "").trim(),
      accessToken: (props.getProperty("META_ACCESS_TOKEN") || "").trim(),
      verifyToken: props.getProperty("META_VERIFY_TOKEN") || "",
      webhookSecret: props.getProperty("META_WEBHOOK_SECRET") || "",
      webhookUrl: (props.getProperty("META_WEBHOOK_URL") || props.getProperty("WAPI_WEBHOOK_URL") || "").trim(),
      graphVersion: (props.getProperty("META_GRAPH_VERSION") || "").trim(),
      wabaId: (props.getProperty("META_WABA_ID") || "").trim(),
      displayPhoneNumber: (props.getProperty("META_DISPLAY_PHONE_NUMBER") || "").replace(/\D/g, "")
    };
    if (!meta.phoneNumberId || !meta.accessToken || !meta.verifyToken || !meta.webhookSecret || !/^v\d+\.\d+$/.test(meta.graphVersion)) {
      throw new Error("Configure WHATSAPP_PROVIDER=meta, META_PHONE_NUMBER_ID, META_ACCESS_TOKEN, META_VERIFY_TOKEN, META_WEBHOOK_SECRET e META_GRAPH_VERSION nas Propriedades do script.");
    }
    return meta;
  }
  const config = {
    provider: "wapi",
    instanceId: props.getProperty("WAPI_INSTANCE_ID") || "",
    token: props.getProperty("WAPI_TOKEN") || "",
    webhookSecret: props.getProperty("WAPI_WEBHOOK_SECRET") || "",
    webhookUrl: (props.getProperty("WAPI_WEBHOOK_URL") || "").trim()
  };
  if (!config.instanceId || !config.token || !config.webhookSecret) {
    throw new Error("Configure WAPI_INSTANCE_ID, WAPI_TOKEN e WAPI_WEBHOOK_SECRET nas Propriedades do script.");
  }
  return config;
}

function waWapiRequest(method, path, body) {
  const config = waGetConfig();
  if (config.provider === "meta") {
    if (method.toLowerCase() === "post" && path === "/v1/message/send-text") {
      return waMetaSendText(body && body.phone, body && body.message);
    }
    if (method.toLowerCase() === "post" && path === "/v1/message/download-media") {
      return waMetaDownloadMedia(body && (body.mediaId || body.id));
    }
    throw new Error("A operação " + method.toUpperCase() + " " + path + " não é compatível com a API oficial Meta.");
  }
  const url = "https://api.w-api.app" + path + "?instanceId=" + encodeURIComponent(config.instanceId);
  const options = {
    method: method,
    contentType: "application/json",
    headers: { Authorization: "Bearer " + config.token },
    muteHttpExceptions: true
  };
  if (body !== undefined && body !== null) options.payload = JSON.stringify(body);
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const content = response.getContentText();
  let parsed;
  try {
    parsed = content ? JSON.parse(content) : {};
  } catch (error) {
    parsed = { raw: content };
  }
  if (status < 200 || status >= 300 || parsed.error === true) {
    throw new Error("W-API recusou o envio (HTTP " + status + "): " + (parsed.message || parsed.raw || "erro desconhecido"));
  }
  return parsed;
}

function waMetaRequest(method, path, body) {
  const config = waGetConfig();
  const url = "https://graph.facebook.com/" + config.graphVersion + path;
  const options = {
    method: method,
    contentType: "application/json",
    headers: { Authorization: "Bearer " + config.accessToken },
    muteHttpExceptions: true
  };
  if (body !== undefined && body !== null) options.payload = JSON.stringify(body);
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const content = response.getContentText();
  let parsed;
  try { parsed = content ? JSON.parse(content) : {}; } catch (error) { parsed = { raw: content }; }
  if (status < 200 || status >= 300 || parsed.error) {
    const detail = parsed.error && (parsed.error.message || parsed.error.error_user_msg) || parsed.raw || "erro desconhecido";
    throw new Error("API oficial Meta recusou a operação (HTTP " + status + "): " + detail);
  }
  return parsed;
}

function waMetaSendText(phone, message) {
  const normalized = waNormalizePhone(phone);
  if (!normalized) throw new Error("A Meta exige o telefone do destinatário no formato internacional.");
  return waMetaRequest("post", "/" + encodeURIComponent(waGetConfig().phoneNumberId) + "/messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized,
    type: "text",
    text: { preview_url: false, body: (message || "").toString() }
  });
}

function waMetaDownloadMedia(mediaId) {
  if (!mediaId) throw new Error("A mensagem não contém o ID da mídia da Meta.");
  return waMetaRequest("get", "/" + encodeURIComponent(mediaId));
}

function waSendText(phone, message) {
  const replyCandidates = WA_REPLY_CONTEXT && WA_REPLY_CONTEXT.destinations
    ? WA_REPLY_CONTEXT.destinations
    : [];
  if (!WA_REPLY_CONTEXT || replyCandidates.indexOf(phone) === -1) {
    throw new Error("Envio bloqueado: mensagens automáticas só podem responder ao chat do webhook atual.");
  }
  const destinations = waUniqueStrings([phone].concat(replyCandidates));
  const chunks = waSplitMessage(message.toString(), 3500);
  let lastResponse = null;
  chunks.forEach(function (chunk) {
    let sent = false;
    const errors = [];
    for (let i = 0; i < destinations.length && !sent; i++) {
      const destination = destinations[i];
      try {
        lastResponse = waWapiRequest("post", "/v1/message/send-text", {
          phone: destination,
          message: chunk,
          delayMessage: 1
        });
        sent = true;
      } catch (error) {
        errors.push(destination + ": " + (error && error.message ? error.message : error.toString()));
      }
    }
    if (!sent) throw new Error("Não foi possível responder ao remetente autorizado. " + errors.join(" | "));
  });
  return lastResponse;
}

function waExtractIdentity(payload) {
  const sender = payload.sender && typeof payload.sender === "object"
    ? payload.sender
    : { id: payload.sender || "" };
  const chat = payload.chat && typeof payload.chat === "object" ? payload.chat : {};
  const content = payload.msgContent && typeof payload.msgContent === "object" ? payload.msgContent : {};
  const nestedMessage = content.message && typeof content.message === "object" ? content.message : {};
  const payloadMessage = payload.message && typeof payload.message === "object" ? payload.message : {};
  const keyCandidates = [payload.key, content.key, nestedMessage.key, payloadMessage.key];
  const phoneCandidates = [
    sender.id, sender.phone, sender.phoneNumber, sender.senderPn,
    chat.id, chat.phone, chat.phoneNumber,
    payload.phone, payload.senderPhone, payload.participantPhone
  ];
  const lidCandidates = [sender.senderLid, sender.lid, sender.id, chat.lid, chat.id, payload.senderLid, payload.chatLid];
  keyCandidates.forEach(function (key) {
    if (!key || typeof key !== "object") return;
    phoneCandidates.push(key.remoteJid, key.senderPn, key.participant, key.participantPn);
    lidCandidates.push(key.senderLid, key.participantLid);
  });

  let phone = "";
  for (let i = 0; i < phoneCandidates.length && !phone; i++) {
    phone = waPhoneFromWebhookValue(phoneCandidates[i]);
  }
  let lid = "";
  for (let i = 0; i < lidCandidates.length && !lid; i++) {
    lid = waLidFromWebhookValue(lidCandidates[i]);
  }
  const chatId = chat.id ? chat.id.toString().trim() : "";
  const replyCandidates = waUniqueStrings([phone, lid, chatId]);
  const replyTo = replyCandidates[0] || "";
  const key = lid ? "LID:" + lid : (phone ? "PHONE:" + phone : (chatId ? "CHAT:" + chatId : ""));
  return {
    phone: phone,
    lid: lid,
    replyTo: replyTo,
    replyCandidates: replyCandidates,
    key: key,
    pushName: sender.pushName ? sender.pushName.toString().trim() : ""
  };
}

function waExtractText(payload) {
  let content = payload.msgContent || {};
  if (content.message && typeof content.message === "object") content = content.message;
  if (typeof content.conversation === "string") return content.conversation;
  if (content.extendedTextMessage && content.extendedTextMessage.text) return content.extendedTextMessage.text;
  if (content.buttonsResponseMessage) {
    return content.buttonsResponseMessage.selectedButtonId || content.buttonsResponseMessage.selectedDisplayText || "";
  }
  if (content.listResponseMessage) {
    const reply = content.listResponseMessage.singleSelectReply || {};
    return reply.selectedRowId || content.listResponseMessage.title || "";
  }
  if (content.templateButtonReplyMessage) {
    return content.templateButtonReplyMessage.selectedId || content.templateButtonReplyMessage.selectedDisplayText || "";
  }
  const media = waExtractMedia(payload);
  return media && media.caption ? media.caption : "";
}

function waExtractLocation(payload) {
  let content = payload.msgContent || {};
  if (content.message && typeof content.message === "object") content = content.message;
  const location = content.locationMessage || content.liveLocationMessage;
  if (!location) return null;
  const lat = Number(location.degreesLatitude);
  const lon = Number(location.degreesLongitude);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

function waExtractMedia(payload) {
  let content = payload.msgContent || {};
  if (content.message && typeof content.message === "object") content = content.message;
  const candidates = [
    { key: "imageMessage", type: "image" },
    { key: "documentMessage", type: "document" },
    { key: "videoMessage", type: "video" },
    { key: "audioMessage", type: "audio" }
  ];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const value = content[candidate.key];
    if (value) {
      return {
        type: candidate.type,
        mediaId: value.id,
        mediaKey: value.mediaKey,
        directPath: value.directPath,
        mimetype: value.mimetype,
        fileName: value.fileName,
        caption: value.caption || ""
      };
    }
  }
  return null;
}

// ==========================================
// PERSISTÊNCIA
// ==========================================

function waGetOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function waGetSession(key) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = waGetOrCreateSheet(ss, WA_SESSIONS_SHEET, ["Chave", "Estado", "Dados JSON", "Atualizado em"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === key) {
      const updated = values[i][3] instanceof Date ? values[i][3].getTime() : new Date(values[i][3]).getTime();
      if (!updated || new Date().getTime() - updated > WA_SESSION_TTL_MS) {
        return { state: "IDLE", data: {}, rowIndex: i + 1 };
      }
      let data = {};
      try { data = values[i][2] ? JSON.parse(values[i][2].toString()) : {}; } catch (error) { data = {}; }
      return { state: values[i][1] || "IDLE", data: data, rowIndex: i + 1 };
    }
  }
  return { state: "IDLE", data: {}, rowIndex: -1 };
}

function waSetSession(key, state, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_SESSIONS_SHEET, ["Chave", "Estado", "Dados JSON", "Atualizado em"]);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString() === key) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[state, JSON.stringify(data || {}), new Date()]]);
        return;
      }
    }
    sheet.appendRow([key, state, JSON.stringify(data || {}), new Date()]);
  } finally {
    lock.releaseLock();
  }
}

function waClearSession(key) {
  waSetSession(key, "IDLE", {});
}

function waFindLinkedUser(identity) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = waGetOrCreateSheet(ss, WA_USERS_SHEET, [
    "Email", "Nome", "Telefone", "LID", "Consentimento", "Status", "Vinculado em", "Último contato"
  ]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const email = values[i][0] ? values[i][0].toString().toLowerCase().trim() : "";
    const phone = values[i][2] ? waNormalizePhone(values[i][2]) : "";
    const lid = values[i][3] ? values[i][3].toString().trim() : "";
    const status = values[i][5] ? waNormalizeCommand(values[i][5]) : "";
    const linkedAt = values[i][6];
    const samePhone = Boolean(identity.phone && phone && phone === waNormalizePhone(identity.phone));
    const sameLid = Boolean(identity.lid && lid && lid === identity.lid);
    // A vinculação permanece ativa depois do primeiro acesso; a pessoa só
    // precisa usar MENU quando quiser voltar ao atendimento.
    if (email && status === "ATIVO" && linkedAt && (samePhone || sameLid)) {
      return {
        email: email,
        nome: values[i][1].toString(),
        phone: phone,
        lid: lid,
        rowIndex: i + 1
      };
    }
  }
  return null;
}

/**
 * A coluna Telefone da aba WhatsApp Usuários é a allowlist do canal. Uma
 * linha com telefone preenchido autoriza o primeiro contato, mas não cria
 * vínculo automaticamente: o onboarding ainda confirma o e-mail por OTP.
 * Use "Bloqueado" ou "Inativo" na coluna Status para impedir o contato.
 */
function waIsSenderListedInSheet(identity) {
  if (!identity) return false;
  const normalizedPhone = identity.phone ? waNormalizePhone(identity.phone) : "";
  const lid = identity.lid ? identity.lid.toString().trim() : "";
  if (!normalizedPhone && !lid) return false;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = waGetOrCreateSheet(ss, WA_USERS_SHEET, [
    "Email", "Nome", "Telefone", "LID", "Consentimento", "Status", "Vinculado em", "Último contato"
  ]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowPhone = values[i][2] ? waNormalizePhone(values[i][2]) : "";
    const rowLid = values[i][3] ? values[i][3].toString().trim() : "";
    const status = values[i][5] ? waNormalizeCommand(values[i][5]) : "";
    if (status === "BLOQUEADO" || status === "INATIVO") continue;
    const samePhone = Boolean(normalizedPhone && rowPhone && rowPhone === normalizedPhone);
    const sameLid = Boolean(lid && rowLid && rowLid === lid);
    if (samePhone || sameLid) {
      if (values[i][0] && !waGetUserRecordByEmail(values[i][0])) return false;
      return true;
    }
  }
  return false;
}

function waUpsertLinkedUser(email, identity) {
  const user = waGetUserRecordByEmail(email);
  if (!user) throw new Error("Usuário não encontrado ou inativo.");
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_USERS_SHEET, [
      "Email", "Nome", "Telefone", "LID", "Consentimento", "Status", "Vinculado em", "Último contato"
    ]);
    const values = sheet.getDataRange().getValues();
    let emailRowIndex = -1;
    const identityRowIndexes = [];
    for (let i = 1; i < values.length; i++) {
      const rowEmail = values[i][0] ? values[i][0].toString().toLowerCase().trim() : "";
      const rowPhone = values[i][2] ? waNormalizePhone(values[i][2]) : "";
      const rowLid = values[i][3] ? values[i][3].toString().trim() : "";
      if (rowEmail === email) emailRowIndex = i + 1;
      if ((identity.phone && rowPhone === waNormalizePhone(identity.phone)) || (identity.lid && rowLid === identity.lid)) {
        identityRowIndexes.push(i + 1);
      }
    }
    let rowIndex = emailRowIndex > 0 ? emailRowIndex : (identityRowIndexes[0] || -1);

    // Um identificador de WhatsApp só pode apontar para uma conta ativa. Se a
    // nova verificação substituir um vínculo anterior, o anterior é encerrado.
    identityRowIndexes.forEach(function (conflictingRowIndex) {
      if (conflictingRowIndex !== rowIndex) {
        sheet.getRange(conflictingRowIndex, 5).setValue("Não");
        sheet.getRange(conflictingRowIndex, 6).setValue("Desvinculado");
      }
    });
    const row = [email, user.nome, identity.phone, identity.lid, "Sim", "Ativo", new Date(), new Date()];
    if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else {
      sheet.appendRow(row);
      rowIndex = sheet.getLastRow();
    }
    return { email: email, nome: user.nome, phone: identity.phone, lid: identity.lid, rowIndex: rowIndex };
  } finally {
    lock.releaseLock();
  }
}

function waTouchLinkedUser(rowIndex, identity) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WA_USERS_SHEET);
  if (!sheet || rowIndex < 2) return;
  if (identity.phone) sheet.getRange(rowIndex, 3).setValue(identity.phone);
  if (identity.lid) sheet.getRange(rowIndex, 4).setValue(identity.lid);
  sheet.getRange(rowIndex, 8).setValue(new Date());
}

function waDeactivateLink(rowIndex) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WA_USERS_SHEET);
  if (sheet && rowIndex > 1) {
    sheet.getRange(rowIndex, 5).setValue("Não");
    sheet.getRange(rowIndex, 6).setValue("Desvinculado");
  }
}

function waClaimEvent(payload, identity) {
  const messageKey = payload.messageId || payload.id || payload.messageKey ||
    [payload.moment || payload.timestamp || "", waExtractText(payload), JSON.stringify(waExtractLocation(payload) || {})].join(":");
  const rawKey = [payload.instanceId || "", payload.event || "", messageKey, identity.key].join(":");
  const key = waHash(rawKey);
  const cache = CacheService.getScriptCache();
  if (cache.get("wa_event_" + key)) return { duplicate: true, rowIndex: -1, key: key };

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_EVENTS_SHEET, [
      "Chave", "Recebido em", "Evento", "Remetente", "Status", "Erro"
    ]);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const found = sheet.getRange(2, 1, lastRow - 1, 1)
        .createTextFinder(key).matchEntireCell(true).findNext();
      if (found) {
        const rowIndex = found.getRow();
        const row = sheet.getRange(rowIndex, 2, 1, 4).getValues()[0];
        const receivedAt = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();
        const status = waNormalizeCommand(row[3]);
        const isRecentProcessing = status === "PROCESSANDO" && receivedAt &&
          new Date().getTime() - receivedAt < 10 * 60 * 1000;
        if (status === "CONCLUIDO" || status === "DUPLICADO" || isRecentProcessing) {
          cache.put("wa_event_" + key, "1", status === "CONCLUIDO" ? 21600 : 600);
          return { duplicate: true, rowIndex: rowIndex, key: key };
        }

        // Mensagens que falharam ou ficaram presas em processamento podem ser
        // tentadas de novo; não ficam bloqueadas como duplicadas para sempre.
        sheet.getRange(rowIndex, 5, 1, 2).setValues([["Processando", ""]]);
        cache.put("wa_event_" + key, "1", 600);
        return { duplicate: false, rowIndex: rowIndex, key: key };
      }
    }
    sheet.appendRow([key, new Date(), payload.event || "", identity.key, "Processando", ""]);
    const rowIndex = sheet.getLastRow();
    cache.put("wa_event_" + key, "1", 600);
    return { duplicate: false, rowIndex: rowIndex, key: key };
  } finally {
    lock.releaseLock();
  }
}

function waFinishEvent(eventClaim, status, errorMessage) {
  const rowIndex = eventClaim && eventClaim.rowIndex;
  if (!rowIndex || rowIndex < 2) return;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WA_EVENTS_SHEET);
  if (sheet) sheet.getRange(rowIndex, 5, 1, 2).setValues([[status, errorMessage || ""]]);
  if (eventClaim.key) {
    const cache = CacheService.getScriptCache();
    const cacheKey = "wa_event_" + eventClaim.key;
    if (status === "Concluído") cache.put(cacheKey, "1", 21600);
    else cache.remove(cacheKey);
  }
}

function waAuditWebhook(payload, status, detail) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = waGetOrCreateSheet(ss, WA_EVENTS_SHEET, [
      "Chave", "Recebido em", "Evento", "Remetente", "Status", "Erro"
    ]);
    const sender = payload && payload.sender && typeof payload.sender === "object"
      ? (payload.sender.id || payload.sender.senderLid || "")
      : (payload && payload.sender ? payload.sender : "");
    sheet.appendRow(["", new Date(), (payload && payload.event) || "", sender, status, detail || ""]);
  } catch (auditError) {
    console.error("Falha ao registrar auditoria do webhook: " + auditError.toString());
  }
}

function waIsMessageBeforeWebhookActivation(payload) {
  const propertyName = waGetConfig().provider === "meta" ? "META_WEBHOOK_ACTIVATED_AT" : "WAPI_WEBHOOK_ACTIVATED_AT";
  const activatedAt = Number(PropertiesService.getScriptProperties().getProperty(propertyName) || 0);
  const messageAt = waGetPayloadTimestamp(payload);
  // Sem um marco criado por configureWhatsAppReceivedWebhook(), ou sem um
  // timestamp confiável no payload, não há como provar que a mensagem é nova.
  // Falhar fechado evita responder filas históricas da W-API do nada.
  if (!activatedAt || !messageAt) return true;
  return messageAt < activatedAt;
}

function waGetPayloadTimestamp(payload) {
  const content = payload && payload.msgContent && typeof payload.msgContent === "object"
    ? payload.msgContent
    : {};
  const nestedMessage = content.message && typeof content.message === "object" ? content.message : {};
  const payloadMessage = payload && payload.message && typeof payload.message === "object" ? payload.message : {};
  const candidates = [
    payload && payload.moment,
    payload && payload.timestamp,
    payload && payload.messageTimestamp,
    content.moment,
    content.timestamp,
    content.messageTimestamp,
    nestedMessage.moment,
    nestedMessage.timestamp,
    nestedMessage.messageTimestamp,
    payloadMessage.moment,
    payloadMessage.timestamp,
    payloadMessage.messageTimestamp
  ];
  for (let i = 0; i < candidates.length; i++) {
    const value = candidates[i];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(value.toString())) {
      const numeric = Number(value);
      if (isFinite(numeric) && numeric > 0) return numeric < 100000000000 ? numeric * 1000 : numeric;
    }
    const parsed = new Date(value).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

function waIsMessageFromInstance(payload) {
  const sender = payload && payload.sender && typeof payload.sender === "object" ? payload.sender : {};
  const content = payload && payload.msgContent && typeof payload.msgContent === "object" ? payload.msgContent : {};
  const nestedMessage = content.message && typeof content.message === "object" ? content.message : {};
  const payloadMessage = payload && payload.message && typeof payload.message === "object" ? payload.message : {};
  return Boolean(payload && payload.fromMe === true ||
    sender.fromMe === true ||
    payload && payload.key && payload.key.fromMe === true ||
    content.key && content.key.fromMe === true ||
    nestedMessage.key && nestedMessage.key.fromMe === true ||
    payloadMessage.key && payloadMessage.key.fromMe === true);
}

// ==========================================
// HELPERS
// ==========================================

function waGetUserRecordByEmail(email) {
  if (!email) return null;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(NOME_ABA_USUARIOS);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  const target = email.toString().toLowerCase().trim();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString().toLowerCase().trim() === target) {
      const status = values[i][8] ? waNormalizeCommand(values[i][8]) : "";
      if (memberInactive(status)) return null;
      return {
        email: target,
        nome: values[i][1] ? values[i][1].toString() : target,
        role: values[i][2] ? values[i][2].toString() : "user",
        cursos: values[i][3] ? values[i][3].toString() : "",
        areas: values[i][4] ? values[i][4].toString() : "",
        turma: values[i][5] ? values[i][5].toString() : ""
      };
    }
  }
  return null;
}

function waIsAuthorizedSender(identity) {
  if (!identity) return false;
  return waIsSenderListedInSheet(identity);
}

function waNormalizePhone(phone) {
  let digits = (phone || "").toString().replace(/\D/g, "");
  if (!digits) return "";

  // A allowlist é internacional: aceita +34..., +55..., 0034... e outros
  // formatos com DDI. Para evitar colisões entre países, não inferimos DDI.
  if (digits.indexOf("00") === 0) digits = digits.substring(2);
  return digits;
}

function waPhoneFromWebhookValue(value) {
  if (value === undefined || value === null) return "";
  const raw = value.toString().trim();
  const lower = raw.toLowerCase();
  // LIDs e grupos não são números discáveis. Só usamos um telefone real como
  // chave da allowlist; os LIDs ficam apenas como alternativa de resposta.
  if (!raw || lower.indexOf("@lid") !== -1 || lower.indexOf("@g.us") !== -1 || lower === "status@broadcast") return "";
  const phone = waNormalizePhone(raw);
  return /^\d{7,15}$/.test(phone) ? phone : "";
}

function waLidFromWebhookValue(value) {
  if (value === undefined || value === null) return "";
  const lid = value.toString().trim();
  return lid.toLowerCase().indexOf("@lid") !== -1 ? lid : "";
}

function waUniqueStrings(values) {
  const unique = [];
  (values || []).forEach(function (value) {
    const item = value === undefined || value === null ? "" : value.toString().trim();
    if (item && unique.indexOf(item) === -1) unique.push(item);
  });
  return unique;
}

function waDescribeIdentity(identity) {
  const phone = identity && identity.phone ? identity.phone.toString() : "";
  const maskedPhone = phone ? "***" + phone.slice(-4) : "ausente";
  const lid = identity && identity.lid ? identity.lid.toString() : "ausente";
  return "Identificação recebida: telefone=" + maskedPhone + "; LID=" + lid + ".";
}

function waIsAdmin(email) {
  const role = getUserRole(email);
  return role === "admin" || role === "master_admin";
}

function waParseTextOutput(output) {
  if (!output) return { status: "error", message: "Resposta vazia do servidor." };
  if (typeof output === "object" && typeof output.getContent === "function") {
    try { return JSON.parse(output.getContent()); }
    catch (error) { return { status: "error", message: "Resposta inválida do servidor." }; }
  }
  return output;
}

function waCallLocked(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function waNormalizeCommand(value) {
  return (value || "").toString().trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function waLooksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").toString().trim());
}

function waParseMonth(value) {
  const normalized = waNormalizeCommand(value);
  const numeric = parseInt(normalized, 10);
  if (!isNaN(numeric) && numeric >= 1 && numeric <= 12) {
    return { name: WA_MONTHS[numeric - 1], number: numeric };
  }
  for (let i = 0; i < WA_MONTHS.length; i++) {
    if (waNormalizeCommand(WA_MONTHS[i]) === normalized) return { name: WA_MONTHS[i], number: i + 1 };
  }
  return null;
}

function waParseAdminDateInput(value) {
  const raw = (value || "").toString().trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  let turma = match[4] ? waNormalizeCommand(match[4]) : "GERAL";
  if (turma === "SABADO") turma = "Sábado";
  else if (turma === "SEXTA") turma = "Sexta";
  else if (turma === "GERAL" || turma === "TODOS" || turma === "AMBOS") turma = "Geral";
  else return null;
  return {
    date: date,
    isoDate: year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2),
    displayDate: ("0" + day).slice(-2) + "/" + ("0" + month).slice(-2) + "/" + year,
    turma: turma
  };
}

function waSelectCodedItems(command, prefix, items) {
  if (command === "TODOS") return items.slice();
  const normalized = command.replace(/\s+/g, "");
  const parts = normalized.split(",");
  const selected = [];
  const seen = {};
  for (let i = 0; i < parts.length; i++) {
    const match = parts[i].match(new RegExp("^" + prefix + "?(\\d+)$"));
    if (!match) return [];
    const index = parseInt(match[1], 10) - 1;
    if (!items[index]) return [];
    if (!seen[index]) {
      selected.push(items[index]);
      seen[index] = true;
    }
  }
  return selected;
}

function waIsFreeValue(value) {
  const normalized = waNormalizeCommand(value || "GRATIS");
  return normalized.indexOf("GRATIS") !== -1 || normalized.indexOf("GRATUITO") !== -1 ||
    normalized === "0" || normalized === "R$ 0" || normalized === "R$ 0,00";
}

function waGenerateOtp() {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + ":" + new Date().getTime(),
    Utilities.Charset.UTF_8
  );
  let number = 0;
  for (let i = 0; i < 4; i++) number = (number * 256) + (digest[i] & 255);
  return String(100000 + (number % 900000));
}

function waGenerateActivationCode() {
  // Código de 32 bits em hexadecimal: fácil de digitar e inviável de adivinhar
  // no período de validade de 24 horas.
  return Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
}

function waHash(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value.toString(),
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    const n = byte < 0 ? byte + 256 : byte;
    return ("0" + n.toString(16)).slice(-2);
  }).join("");
}

function waSafeEquals(a, b) {
  a = (a || "").toString();
  b = (b || "").toString();
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    mismatch |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  }
  return mismatch === 0 && a.length > 0;
}

function waMaskEmail(email) {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const visible = name.substring(0, Math.min(2, name.length));
  return visible + "***@" + parts[1];
}

function waEscapeHtml(value) {
  return (value || "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function waExtensionForMime(mimeType) {
  const normalized = (mimeType || "").toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized.indexOf("png") !== -1) return "png";
  if (normalized.indexOf("webp") !== -1) return "webp";
  return "jpg";
}

function waSplitMessage(message, maxLength) {
  if (message.length <= maxLength) return [message];
  const chunks = [];
  let remaining = message;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt < maxLength * 0.5) splitAt = maxLength;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).replace(/^\s+/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
