# WhatsApp como frontend do TUIG

Esta integração mantém o PWA existente e adiciona um segundo frontend conversacional:

```text
Pessoa no WhatsApp
        │
        ▼
Número dedicado conectado à W-API
        │ webhook de mensagem recebida
        ▼
Google Apps Script (Code.gs + WhatsApp.gs)
        │
        ├── Google Sheets (cadastros, presenças, sessões e auditoria)
        ├── Google Drive (comprovantes)
        └── Gmail/MailApp (código de vinculação)
```

## O que esta primeira versão já faz

- identifica o remetente por `senderLid` e usa o telefone como fallback;
- vincula o WhatsApp a um usuário ativo por código de seis dígitos enviado ao e-mail cadastrado;
- guarda a vinculação para os próximos atendimentos;
- guarda a vinculação do WhatsApp após a confirmação por e-mail;
- oferece menu por texto compatível com instâncias W-API LITE e PRO;
- consulta dados pessoais, frequência, histórico, rituais e mensalidades;
- marca presença recebendo a localização do WhatsApp;
- recebe justificativa de falta;
- baixa imagens/PDFs recebidos e envia comprovantes de mensalidade ou curso;
- lista e realiza inscrição em cursos;
- lista livros, solicita empréstimo e cancela solicitação pendente;
- mostra um resumo administrativo para usuários `admin` e `master_admin`;
- evita reprocessar o mesmo webhook e registra eventos para auditoria.

## Ativação

### 1. Adicionar os arquivos ao Apps Script

No mesmo projeto do Apps Script usado hoje pelo TUIG, mantenha `Code.gs` e crie outro arquivo de script chamado `WhatsApp.gs`. Copie para ele o conteúdo do arquivo homônimo deste projeto.

Não coloque o token da W-API no código, no PWA ou na planilha.

### 2. Criar as propriedades secretas

No editor do Apps Script, abra **Configurações do projeto > Propriedades do script** e crie:

| Propriedade | Valor |
|---|---|
| `WAPI_INSTANCE_ID` | ID da instância criada no painel W-API |
| `WAPI_TOKEN` | token Bearer da instância |
| `WAPI_WEBHOOK_SECRET` | segredo aleatório longo, exclusivo desta integração |
| `WAPI_WEBHOOK_URL` | URL pública da implantação do Apps Script, terminada em `/exec` |

Use pelo menos 32 caracteres aleatórios no `WAPI_WEBHOOK_SECRET`. Se ele for exposto, gere outro e execute novamente a configuração do webhook.

Não use a URL terminada em `/dev`: ela é exclusiva do modo de desenvolvimento. Copie a URL `/exec` em **Implantar > Gerenciar implantações** e salve-a em `WAPI_WEBHOOK_URL`. A configuração do webhook valida essa URL antes de enviá-la à W-API.

`WAPI_WEBHOOK_ACTIVATED_AT` é criada e atualizada automaticamente por `configureWhatsAppReceivedWebhook()`; ela impede respostas a mensagens pendentes anteriores à ativação.

### 3. Criar as abas de apoio

Ao executar a configuração do webhook, o Apps Script criará, se necessário:

- `WhatsApp Usuários` — vínculos, consentimento e último contato;
- `WhatsApp Sessões` — etapa atual de cada conversa;
- `WhatsApp Eventos` — deduplicação e auditoria dos webhooks.
- A coluna `Ativar bot` na aba `WhatsApp Usuários` — ativações individuais; o registro técnico fica oculto.

Na primeira execução, conceda acesso a Sheets, envio de e-mail, Drive e requisições externas.

### 4. Implantar uma nova versão do App da Web

Em **Implantar > Gerenciar implantações**, publique uma nova versão usando a implantação atual:

- executar como o proprietário do sistema;
- acesso público, porque a W-API precisa chamar o webhook;
- conservar a URL `/exec` da implantação sempre que possível.

O segredo na URL protege a rota do webhook. O código também confere o `instanceId` recebido.

### 5. Verificar a instância e cadastrar o webhook

Com o número já conectado à instância W-API, execute no editor:

```javascript
configureWhatsAppReceivedWebhook()
```

Essa função cadastra na W-API a URL de mensagens recebidas no formato:

```text
URL_DO_APP_DA_WEB/exec?wa_secret=SEGREDO
```

Ela usa a rota `PUT /v1/webhook/update-webhook-received`; mensagens de saída usam `POST /v1/message/send-text`, e mídias recebidas usam `POST /v1/message/download-media`.

## Ativação individual de números com falha de identificação

Quando a W-API entregar somente o LID de uma pessoa, sem o telefone, use a ativação individual para associar o LID com segurança.

1. Abra a aba `WhatsApp Usuários` e deixe o telefone completo, com DDI, na coluna `Telefone`.
2. Após atualizar a implantação e executar `configureWhatsAppReceivedWebhook()`, a coluna `Ativar bot` aparece automaticamente.
3. Marque a caixa `Ativar bot` na linha daquela pessoa.
4. O sistema envia um convite individual com um código de oito caracteres e desmarca a caixa novamente.
5. A pessoa responde `ATIVAR CÓDIGO` em até 24 horas.
6. O sistema registra o LID recebido e pede o e-mail para concluir a confirmação normal por código.

O convite só pode ser enviado manualmente para um telefone já presente na planilha. Não há ativação em massa, e a pessoa continua precisando confirmar a própria identidade por e-mail.

## Teste de aceite

Faça os testes primeiro com um número de WhatsApp que não seja o número conectado à instância.

1. Cadastre o telefone de teste na coluna `Telefone` da aba `WhatsApp Usuários` e envie `Olá`; confirme que o bot pede o e-mail.
2. Informe um e-mail ativo da aba `Usuários`.
3. Confirme que o código chega nesse e-mail e expira em dez minutos.
4. Teste um código incorreto e depois o correto.
5. Envie `MENU` e percorra as opções 2, 3, 4 e 5.
6. Durante uma janela válida, escolha presença e compartilhe a localização atual.
7. Teste uma justificativa de falta dentro do prazo.
8. Envie `COMPROVANTE AGOSTO`, escreva uma observação ou `PULAR`, e depois uma imagem ou PDF de até 5 MB.
9. Teste inscrição em curso grátis e pago.
10. Teste solicitação e cancelamento de livro.
11. Envie novamente um webhook já processado e confirme que não duplica registros.
12. Teste `MENU` e `CANCELAR` durante uma operação; em ambos os casos, o sistema deve voltar ao menu sem apagar dados já registrados.
13. Envie uma mensagem de um número que não esteja na coluna `Telefone` e confirme que não há resposta, sessão nem evento concluído para ele.

Confira também as três abas `WhatsApp ...` e os registros criados nas abas funcionais.

Se o atendimento não responder, confira se a implantação `/exec` está publicada, se o webhook está configurado para a instância correta e se o evento aparece na aba `WhatsApp Eventos`.

## Decisões operacionais recomendadas

- Use um número exclusivo do TUIG. Isso separa conversas pessoais, facilita auditoria e reduz respostas humanas concorrendo com o bot.
- Comece com um grupo piloto pequeno e só depois divulgue o número para todos.
- Mantenha menus por texto enquanto estiver na instância LITE. A instância PRO pode trocar parte do fluxo por botões e listas, mas não é necessária para esta versão.
- O sistema não envia mensagens proativas: ele responde apenas a mensagens recebidas de telefones autorizados.
- Defina um procedimento humano de atendimento para mensagens que o bot não reconheça.

## Escopo que ainda falta para substituir todo o site

O frontend do médium já cobre o núcleo operacional, mas a substituição integral do site ainda requer uma segunda etapa, principalmente administrativa:

- aprovar/rejeitar mensalidades e justificativas pelo WhatsApp;
- chamada em massa e correção retroativa com confirmação forte;
- cadastro/edição de livros, cursos, agenda, usuários e rituais;
- retirada e devolução de livros por administradores;
- relatórios completos e envio de PDF;
- notificações proativas, lembretes e fila de atendimento humano;
- política de retenção/limpeza das abas de sessões e eventos;
- migração da autenticação básica do PWA, que ainda confia no e-mail informado pelo navegador.

O envio de comprovantes reaproveita a implementação atual do sistema, que cria links do Drive acessíveis a quem possuir o link. Antes de ampliar o uso, vale decidir se os administradores acessarão os arquivos por uma conta Google autorizada; nesse caso, a permissão dos arquivos pode ser restringida.
