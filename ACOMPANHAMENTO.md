# Central de acompanhamento — primeira entrega

Implementada no código local. A publicação do site e de uma nova versão do Apps Script ainda é necessária; os testes não acessam a planilha real.

## Fluxo

Na administração, abra **Acompanhamento** (também há atalhos no Painel Gerencial e no Financeiro). A central abre diretamente para quem já entrou como administrador no sistema.

1. Filtre nome, turma, assunto, situação e período.
2. Selecione uma pendência e revise a mensagem pronta.
3. Abra o WhatsApp e envie manualmente. O link utiliza a conta que estiver aberta: confirme que é o seu número pessoal. O sistema não escolhe a conta remetente.
4. Volte, confirme que realizou o contato e clique em **Registrar contato realizado**. Se editou o texto no WhatsApp, ajuste a cópia no sistema antes de confirmar.
5. Use **Salvar só a situação / observação** para registrar retorno ou resolução sem afirmar que enviou mensagem.

Não há envio automático, chamada à W-API, leitura de conversas, confirmação automática de entrega nem uma segunda licença. A data de retorno aparece na lista; não cria lembretes enviados pelo WhatsApp.

## Dados e regras

- Presenças: últimos 30 dias por padrão, período ajustável até um ano. Considera agenda da turma, exclui hoje/futuro, datas duplicadas, presença registrada e justificativa aprovada ou pendente. Ausência de registro é uma pendência de conferência, não prova de falta.
- Mensalidades: mês anterior por padrão; somente meses encerrados. Pagamentos aprovados/pagos, isenção registrada como `Isento` e comprovantes pendentes não entram na fila. Sem vencimento definido, não declara inadimplência. Não infere obrigação financeira nem isenção pelo cargo da pessoa.
- Se existir a coluna `Data de ingresso` ou `Ingresso em` na aba `Usuários`, períodos anteriores são excluídos. Sem ela, a tela avisa que é preciso conferir a participação da pessoa naquele período.
- O telefone vem de `WhatsApp Usuários`, pelo mesmo e-mail. Deve estar completo com DDI; pontuação é removida. Não usa LID nem acrescenta `55`. Vínculos ambíguos, bloqueados/inativos/revogados ou sem telefone deixam o botão de conversa indisponível. Ainda é possível copiar o texto e registrar uma conversa manual.
- Administradores veem as pessoas permitidas pelas suas áreas. Mensalidades na nova central são exclusivas do `master_admin`, acompanhando a permissão da tela Financeiro.
- Registros de contato guardam pessoa, assunto, referência, horário do registro, administrador responsável, mensagem declarada, telefone e observações. Atualizações de situação são eventos separados. O histórico continua disponível após o pagamento/presença ser corrigido, desde que a pessoa continue no acesso do administrador.
- Marcar um acompanhamento como resolvido não altera pagamentos, presenças nem justificativas.
- A aba `Acompanhamento` é criada automaticamente na primeira gravação, sem testes ou rotinas de configuração manuais. Uma aba preexistente com cabeçalho diferente não é sobrescrita.

## Segurança e limites desta etapa

As novas rotas revalidam a permissão e o alcance do administrador em cada operação. Há deduplicação por identificador, bloqueio de gravações simultâneas e proteção contra fórmulas nas células de texto. O cache offline deixa de guardar respostas externas da API.

Isso **não corrige toda a autenticação antiga do aplicativo**: outras rotas legadas ainda recebem e-mail do navegador como identificação. A migração delas para autenticação verificável é uma etapa de segurança separada; não deve ser considerada concluída por esta entrega. O bot e o login antigo não foram alterados.

## Publicação

1. Atualizar `Code.gs` no mesmo projeto Apps Script, mantendo `WhatsApp.gs` e as configurações existentes. Autorizar `MailApp` se solicitado pelo Google.
2. Publicar uma **nova versão na implantação existente**, preservando a URL usada pelo site e pelo webhook. Apenas salvar o código não atualiza a versão publicada.
3. Publicar o conteúdo de `dist/` gerado por `npm run build` no caminho atual `/sistema/`. Não substituir a URL do webhook nem reconfigurar a W-API.

O ambiente local não possui configuração autenticada de publicação. Nenhuma mensagem real, mudança na planilha ou implantação foi feita durante a verificação.

## Verificação automatizada

- `npm test`: regras do backend, acesso, telefones internacionais/ambíguos, pagamentos, justificativas, datas, gravação, histórico e duplicidade.
- `npm run build`: compilação da aplicação.
- `tests/followup.browser.cjs`: teste com Playwright/Chrome, servidor local e dados fictícios. Intercepta toda API externa e o link do WhatsApp; cobre confirmação de acesso, abertura manual, registro, atualização, escape de texto e layout de computador/celular. Não é um teste manual incluído no Apps Script.

Os testes locais não certificam implantação, permissões de e-mail ou qualidade dos dados da planilha em produção.
