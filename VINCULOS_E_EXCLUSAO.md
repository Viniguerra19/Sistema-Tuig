# Vínculos e exclusão de dados

## Uso

- A administração principal tem a aba **Vínculos e saídas**, com busca incluindo pessoas inativas, afastadas, desligadas e com exclusão pendente.
- Afastar bloqueia o acesso no site e o atendimento do WhatsApp. O cadastro, vínculo do WhatsApp e histórico são preservados.
- Reativar restaura o acesso. Dias de afastamento ficam fora do cálculo de faltas; meses com qualquer período de afastamento não geram lembrete de mensalidade. Pagamentos já registrados continuam existindo. Não há cálculo proporcional automático.
- O aluno solicita afastamento ou exclusão em **Meu vínculo com o terreiro**, dentro do painel após entrar. A tela de login não contém essas ações. Pessoas afastadas precisam solicitar reativação à administração.
- Todas as alterações de vínculo exigem código no e-mail de quem executa a ação. O titular pode pedir exclusão; o master também pode iniciá-la diretamente, sem pedido prévio. Somente `master_admin` pode conferir e executá-la.
- **Registrar Irmão** foi retirado. A presença individual aceita somente a própria pessoa. A chamada administrativa continua disponível.

## Conferência e execução da exclusão

1. O master seleciona a pessoa no painel, mesmo que esteja ativa e não tenha solicitado exclusão. Alternativamente, o titular pode confirmar um pedido pelo e-mail; nesse caso, recebe `Exclusão pendente` e perde acesso.
2. O administrador abre **Deletar todos os dados**. O sistema lê todas as abas das duas planilhas configuradas em `Code.gs` (principal e biblioteca).
3. A busca usa e-mail, telefone, LID do WhatsApp, identificadores encadeados e nome completo. Também inspeciona valores JSON, fórmulas e links dos registros.
4. Nomes homônimos sem identificador, conteúdo compartilhado, anexos referenciados por outra pessoa e empréstimos em aberto bloqueiam a operação. O painel informa o local a conferir.
5. O administrador confirma com `EXCLUIR` e com código enviado ao seu e-mail. Se os registros mudaram depois da conferência, precisa abrir um novo plano.
6. Ao confirmar a exclusão, o acesso da pessoa é bloqueado antes de remover arquivos. Os anexos identificados são apagados permanentemente no Drive usando `files.delete`, não apenas movidos para a lixeira. Antes de começar, o sistema verifica acesso, permissão e tipo dos arquivos; não exclui pastas ou planilhas como anexos.
7. As linhas vinculadas são removidas de baixo para cima, deixando o cadastro principal por último. Falhas são apresentadas como erro; não há confirmação de sucesso parcial. Arquivos já removidos ficam identificados para retomada por nova conferência.

A exclusão não procura arquivos soltos no Drive sem vínculo nas planilhas, cópias externas, mensagens nas caixas de e-mail, conversas nos aparelhos nem backups. Não elimina o histórico de versões das planilhas mantido pelo Google. Portanto, remove os registros operacionais identificados, mas não representa eliminação de todas as cópias históricas possíveis. Registros sem qualquer identificador reconhecível não podem ser associados automaticamente.

Referência da exclusão de arquivos: [Google Drive — files.delete](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete).

## Publicação

Atualizar `Code.gs` e `WhatsApp.gs`, publicar nova versão da implantação do Apps Script e enviar o conteúdo de `dist/` à hospedagem. A conta executora precisa ter acesso às duas planilhas, envio de e-mail e permissão de exclusão dos anexos no Drive. Se a API do Drive não estiver habilitada no projeto Google Cloud associado ou faltar autorização, a exclusão de anexos retorna erro e mantém as linhas.

A aba `Histórico de vínculos` é criada automaticamente no primeiro afastamento ou pedido de exclusão. Não renomear seus cabeçalhos manualmente. Períodos anteriores à adoção desta funcionalidade não são inferidos: o sistema não conhece quando um cadastro legado foi inativado.

O login comum continua usando o modelo de e-mail existente no projeto. O código adicional protege as novas ações de vínculo e exclusão; ele não substitui a autenticação geral do aplicativo.
