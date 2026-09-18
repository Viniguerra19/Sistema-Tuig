# Entrega da integração WhatsApp do TUIG

Este pacote reúne a integração do frontend conversacional do TUIG. O código suporta a API oficial Meta Cloud e mantém a W-API como provedor legado/fallback.

## API oficial Meta Cloud

Para migrar, defina `WHATSAPP_PROVIDER=meta` e configure `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `META_WEBHOOK_SECRET`, `META_WEBHOOK_URL` e `META_GRAPH_VERSION` nas propriedades do script. O callback da Meta deve usar `META_WEBHOOK_URL?meta_secret=...`, com o objeto `whatsapp_business_account` e o campo `messages` assinado no painel Meta for Developers. A configuração detalhada e o checklist de credenciais estão em `WHATSAPP_SETUP.md`.

O número precisa estar registrado na plataforma WhatsApp Business da Meta. O Apps Script não consegue criar a conta Business, verificar o número ou emitir o token em nome do administrador; essas etapas precisam ser concluídas no painel Meta. Depois de cadastrar as propriedades e publicar uma nova versão do Web App, execute `configureWhatsAppReceivedWebhook()` para registrar o marco de ativação e, se `META_WABA_ID` estiver presente, solicitar a assinatura da conta.

## Arquivos deste pacote

- `WhatsApp.gs`: arquivo completo e atualizado para colar no projeto Apps Script.
- `WHATSAPP_SETUP.md`: documentação geral da integração.
- Este arquivo: checklist para aplicar a correção em outro computador/projeto.

## O que foi descoberto

O webhook estava sendo configurado com uma URL `/dev`. A função `ScriptApp.getService().getUrl()` pode retornar a URL de desenvolvimento quando o Apps Script está sendo executado nesse modo. Para produção, a W-API precisa usar a URL pública da implantação terminada em `/exec`.

Os logs também mostraram dois grupos de eventos:

- vários eventos `Ignorado` por `wa_secret` ausente ou diferente;
- eventos `Concluído` de mensagens pendentes/históricas que foram entregues quando o webhook foi ativado.

Por isso o bot respondeu a números que não tinham enviado mensagem naquele momento.

## Correções incluídas em `WhatsApp.gs`

1. A configuração agora exige a propriedade `WAPI_WEBHOOK_URL` e rejeita URLs `/dev`.
2. Os eventos ignorados são registrados na aba `WhatsApp Eventos` com o motivo.
3. O instante de ativação é salvo automaticamente em `WAPI_WEBHOOK_ACTIVATED_AT`.
4. Mensagens anteriores à ativação são ignoradas para evitar respostas a mensagens históricas pendentes.
5. O processamento só continua para telefones presentes na coluna `Telefone` da aba `WhatsApp Usuários`; números fora da lista não recebem resposta nem iniciam sessão.
6. O sistema só envia mensagens como resposta ao webhook de uma mensagem recebida autorizada; não há disparo manual nem mensagens proativas.
7. Há uma exceção controlada: o administrador marca a caixa `Ativar bot` na planilha para enviar um convite individual a um telefone já cadastrado. A resposta com o código associa o LID ao telefone e não libera números fora da lista.

## Como instalar em casa

1. Abra o projeto Apps Script usado pelo TUIG.
2. Crie ou abra o arquivo `WhatsApp.gs`.
3. Substitua todo o conteúdo pelo arquivo `WhatsApp.gs` deste pacote.
4. Confirme que o `Code.gs` possui, dentro de `doPost(e)`, antes do roteamento por `payload.action`:

```javascript
if (typeof isWhatsAppWebhookPayload === "function" && isWhatsAppWebhookPayload(payload)) {
  return handleWhatsAppWebhook(payload, e);
}
```

5. Salve e autorize novamente os serviços solicitados pelo Apps Script.

## Propriedades do script

Mantenha ou crie estas propriedades:

| Propriedade | Obrigatória | Valor |
|---|---:|---|
| `WAPI_INSTANCE_ID` | Sim | ID da instância no painel W-API |
| `WAPI_TOKEN` | Sim | Token Bearer atual da instância |
| `WAPI_WEBHOOK_SECRET` | Sim | Segredo aleatório longo, exclusivo desta integração |
| `WAPI_WEBHOOK_URL` | Sim | URL pública da implantação Apps Script, terminada em `/exec` |

`WAPI_WEBHOOK_ACTIVATED_AT` não deve ser preenchida manualmente. Ela é criada pela função `configureWhatsAppReceivedWebhook()`.

## Atenção de segurança

O token e o segredo foram expostos em uma imagem durante o diagnóstico. Antes de colocar em produção:

1. Gere um novo token no painel da W-API.
2. Gere um novo `WAPI_WEBHOOK_SECRET`.
3. Atualize os dois valores nas Propriedades do script.
4. Nunca publique esses valores em prints ou mensagens.

Não é necessário trocar o `WAPI_INSTANCE_ID` apenas por causa do print, pois ele identifica a instância; o token e o segredo são as credenciais que devem ser renovadas.

## Implantação correta

Em **Implantar > Gerenciar implantações**:

- publique uma nova versão do App da Web;
- execute como o proprietário do projeto;
- permita acesso externo compatível com a W-API;
- copie a URL pública terminada em `/exec`;
- salve essa URL em `WAPI_WEBHOOK_URL`.

Depois execute:

```javascript
configureWhatsAppReceivedWebhook()
```

Ao executar `configureWhatsAppReceivedWebhook()`, o webhook é atualizado na W-API e o marco de ativação é renovado. Mensagens antigas recebidas depois disso serão ignoradas.

## Teste de recebimento

1. Cadastre um telefone de teste na coluna `Telefone` da aba `WhatsApp Usuários`.
2. Envie `Olá` a partir desse número. O primeiro retorno esperado é uma solicitação do e-mail cadastrado no TUIG.
3. Envie uma mensagem de um telefone que não esteja na coluna `Telefone`. Não deve haver resposta nem sessão criada.

Os únicos comandos globais disponíveis para um usuário vinculado são `MENU` e `CANCELAR`. O primeiro retorna ao menu principal; o segundo encerra a operação atual e também volta ao menu. Não há comandos `SAIR` ou `DESVINCULAR`.

Depois confira a aba `WhatsApp Eventos`:

- `Concluído`: mensagem processada;
- `Ignorado` + `Webhook não autorizado`: URL sem segredo ou segredo diferente;
- `Ignorado` + `Mensagem anterior à ativação`: mensagem antiga, corretamente descartada;
- `Ignorado` + `Remetente não identificado`: payload incompatível da W-API;
- `Erro`: falha interna registrada na coluna `Erro`.

As sessões de onboarding ficam válidas por 24 horas. As linhas antigas da aba `WhatsApp Sessões` podem permanecer para auditoria.
