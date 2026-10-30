# 🌟 Sistema TUIG (Terreiro de Umbanda Irmãos de Gandra)
> **Plataforma Corporativa de Controle de Presenças, Rituais e Gestão de Médiuns**

[![Platform](https://img.shields.io/badge/Platform-PWA-0f172a.svg?style=for-the-badge&logo=javascript)](https://vite.dev/)
[![Backend](https://img.shields.io/badge/Backend-Google_Apps_Script-34a853.svg?style=for-the-badge&logo=google-sheets)](https://developers.google.com/apps-script)
[![Vite](https://img.shields.io/badge/Vite-v7.x-646cff.svg?style=for-the-badge&logo=vite)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-Workbox-0052cc.svg?style=for-the-badge&logo=pwa)](https://vite-pwa-org.netlify.app/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

O **Sistema TUIG** é uma solução corporativa sob medida desenvolvida para a gestão e controle administrativo de Terreiros. O projeto consiste em um aplicativo mobile-first do tipo **PWA (Progressive Web App)** de alta performance que se conecta a uma arquitetura serverless no **Google Apps Script** utilizando planilhas do **Google Sheets** como banco de dados transacional e relacional em nuvem.

---

## 📌 Índice
1. [Arquitetura e Fluxo de Dados](#-arquitetura-e-fluxo-de-dados)
2. [Recursos do Sistema](#-recursos-do-sistema)
3. [Estrutura do Repositório](#-estrutura-do-repositório)
4. [Instalação e Execução Local](#-instalação-e-execução-local)
5. [Configuração do Banco de Dados (Google Sheets)](#-configuração-do-banco-de-dados-google-sheets)
6. [Implantação e Ciclo de Vida (Deploy)](#-implantação-e-ciclo-de-vida-deploy)
7. [Geofencing e Janelas de Funcionamento](#-geofencing-e-janelas-de-funcionamento)
8. [Segurança e Boas Práticas](#-segurança-e-boas-práticas)
9. [Licença](#-licença)

---

## 🏗️ Arquitetura e Fluxo de Dados

A arquitetura do sistema foi desenhada para eliminar custos de infraestrutura e hospedagem de servidores tradicionais (zero-cost maintenance), garantindo velocidade e estabilidade ao delegar o processamento pesado à infraestrutura do Google.

```mermaid
graph TD
    Client[PWA Client - Vanilla JS / Vite] -->|HTTP GET/POST JSON| API[Google Apps Script API Web App]
    API -->|Google Apps Script API| Sheets[(Google Sheets Database)]
    Client -->|Push SDK| OneSignal[OneSignal Push Notification Service]
    Client -.->|Caches offline assets| SW[Service Worker - Workbox precaching]
```

### Detalhes do Fluxo:
1. **Requisições de Leitura (GET)**: O cliente solicita dados passando parâmetros na Query String (Ex: `?action=login&email=...`). O Apps Script consulta as abas da planilha do Google e devolve uma resposta estruturada em JSON contendo um payload de dados e timestamps com cabeçalhos CORS (`*`) liberados.
2. **Requisições de Escrita (POST)**: Operações como gravação de presença, abonos em massa e justificativas utilizam o método `POST` contendo um payload em formato JSON. O Apps Script realiza o parse no servidor e executa inserções atômicas nas tabelas (linhas) correspondentes do Sheets.

---

## 🚀 Recursos do Sistema

### 👤 Portal do Médium (Painel de Autenticação Básica)
*   **Login Passwordless**: Autenticação rápida com validação direta do e-mail do médium cadastrado na planilha.
*   **Geofencing (Presença via GPS)**: Coleta de coordenadas geográficas do usuário no momento do clique, calculando a distância pelo método matemático de Haversine em relação à localização do Terreiro. Bloqueia registros fora da tolerância física (default: 25 metros).
*   **Controle Temporal de Rituais**: Acompanha o histórico de rituais realizados pelo médium e notifica se o intervalo obrigatório (intervalo padrão: 21 dias) entre rituais foi cumprido antes de liberar novas práticas.
*   **Justificativa de Faltas**: Permite a solicitação de abonos ou justificativas de ausências em eventos passados. As informações são enviadas diretamente para revisão dos administradores.

### 🛠️ Painel de Controle Administrativo (Admin & Master Admin)
*   **Métricas Dinâmicas (Dashboard)**: Estatísticas completas que incluem número de médiuns ativos, média de presença por dia, frequência total da turma de Sexta e Sábado.
*   **Controle de Assiduidade**: Ranking ordenado de frequência dos médiuns, destacando visualmente porcentagens de comparecimento baixas.
*   **Chamada em Massa (Abonos e Presenças)**: Possibilita ao administrador marcar a presença de turmas inteiras ou de médiuns individuais de forma retroativa, seja por atrasos de sincronização de GPS ou necessidades rituais.
*   **Relatórios em PDF**: Botão integrado para exportação instantânea em PDF formatado de listas de presença e relatórios.

---

## 📁 Estrutura do Repositório

O projeto adota uma arquitetura limpa e baseada em componentes Vanilla. Abaixo está o mapa e a descrição dos diretórios:

```
├── Code.gs                   # Backend API: Código-fonte do Google Apps Script
├── index.html                # Arquivo raiz do cliente web e inicializador do SPA
├── package.json              # Configurações do npm, scripts de compilação e dependências
├── vite.config.js            # Arquivo de configuração de empacotamento e build do Vite
├── public/                   # Recursos estáticos servidos diretamente pelo PWA
│   ├── logo.png              # Logotipo oficial e ícone do aplicativo
│   ├── manifest.json         # Arquivo de metadados PWA para instalação mobile/desktop
│   ├── sw.js                 # Script do Service Worker configurado via Workbox
└── src/                      # Código-fonte principal do frontend
    ├── config.js             # Configuração da URL da API de Produção
    ├── style.css             # Folha de estilo centralizada do sistema (Dark Mode Premium)
    ├── main.js               # Orquestrador de inicialização, roteamento SPA e controle de sessão
    ├── student.js            # Controladores e views para a área do aluno/médium
    ├── admin.js              # Controladores, views, gráficos (Chart.js) da área administrativa
    └── utils.js              # Helpers, formatação de datas, gerador de modais e cálculos matemáticos
```

---

## 📦 Instalação e Execução Local

### Pré-requisitos
*   [Node.js](https://nodejs.org/) (versão LTS recomendada: 18.x ou 20.x).
*   [NPM](https://www.npmjs.com/) (gerenciador de pacotes padrão do Node).

### Execução Passo a Passo:

1.  **Clone o projeto para seu computador local**:
    ```bash
    git clone https://github.com/Viniguerra19/Sistema-Tuig.git
    cd Sistema-Tuig
    ```

2.  **Instale os pacotes e dependências**:
    ```bash
    npm install
    ```

3.  **Execute o servidor de desenvolvimento**:
    ```bash
    npm run dev
    ```
    O Vite iniciará o projeto localmente no endereço `http://localhost:3000` (ou porta alternativa) e abrirá automaticamente no navegador.

4.  **Gere a build otimizada para produção**:
    ```bash
    npm run build
    ```
    Este comando compila o código-fonte gerando arquivos estáticos minificados na pasta `dist/` pronta para publicação.

---

## 📊 Configuração do Banco de Dados (Google Sheets)

O banco de dados é hospedado em uma Planilha Google. A estrutura e nomenclatura exata das colunas é crítica para o funcionamento do script:

### 1. Estrutura das Abas da Planilha

*   **Aba `Usuários`**: Cadastro geral dos usuários e permissões do sistema.
    *   `Coluna A`: **Email** *(Identificador único/Login)*
    *   `Coluna B`: **Nome**
    *   `Coluna C`: **Permissão** *(`master_admin`, `admin`, ou `user`)*
    *   `Coluna D`: **Cursos** *(Lista separada por vírgulas, ex: `Benzimento, Ervaria`)*
    *   `Coluna E`: **Áreas** *(Configuração de escopo para admins locais)*
    *   `Coluna F`: **Turma** *(`Sexta`, `Sábado` ou `Ambos`)*

*   **Aba `Rituais`**: Registro cronológico de rituais.
    *   `Coluna A`: **Email** *(Chave estrangeira relacionando a Usuários)*
    *   `Coluna B`: **Ritual** *(Nome do ritual realizado)*
    *   `Coluna C`: **Data** *(Formato: DD/MM/YYYY)*
    *   `Coluna D`: **Notas** *(Observações da atividade)*
    *   `Coluna E`: **Etapa** *(`Inicial` ou `Reforço` para assentamentos de esquerda e de entidade; cada realização ocupa uma linha)*

*   **Aba `Presenças`**: Registro de entrada de presença.
    *   `Coluna A`: **Data/Hora** *(Timestamp do envio)*
    *   `Coluna B`: **Email** *(Chave estrangeira relacionando a Usuários)*
    *   `Coluna C`: **Nome**
    *   `Coluna D`: **Registrado Por** *(`Auto` se feito pelo médium ou e-mail do admin)*
    *   `Coluna E`: **Status GPS** *(`Dentro do Raio` ou `Fora do Raio (X metros)`)*
    *   `Coluna F`: **ID do Dispositivo** *(DeviceId gerado para fins de auditoria)*

*   **Aba `Agenda`**: Agenda de eventos do Terreiro.
    *   `Coluna A`: **Data** *(Data limite para presença)*
    *   `Coluna B`: **Nome do Evento**
    *   `Coluna C`: **Turma** *(`Sexta`, `Sábado`, `Geral` ou `Ambos`)*

*   **Aba `Justificativas`**: Logs de justificativa de faltas.
    *   `Coluna A`: **Data Evento**
    *   `Coluna B`: **Email**
    *   `Coluna C`: **Nome**
    *   `Coluna D`: **Motivo**
    *   `Coluna E`: **Status** *(`Pendente`, `Aprovado` ou `Rejeitado`)*

---

## 🚀 Implantação e Ciclo de Vida (Deploy)

### Deploy do Backend (Google Apps Script)
1.  Na sua planilha Google configurada, vá em **Extensões** -> **Apps Script**.
2.  Mantenha `Code.gs`, `WhatsApp.gs` e `Aniversarios.gs` no mesmo projeto do Apps Script, com o conteúdo dos arquivos deste repositório.
3.  Altere as constantes no início do script:
    *   `SPREADSHEET_ID`: Insira o ID da sua planilha (ex: `1N8gsG2A99KI1...voIu4QWc`).
    *   `TERREIRO_LAT` e `TERREIRO_LON`: Ajuste as coordenadas do ponto central geográfico do Terreiro.
    *   `RAIO_TOLERANCIA_METROS`: Distância máxima permitida (default: 25).
4.  Clique em **Implantar** (Deploy) -> **Nova implantação**.
5.  Selecione **App da Web** (Web App).
    *   **Executar como**: `Eu` *(Sua conta do Google)*.
    *   **Quem tem acesso**: `Qualquer pessoa` *(Necessário para comunicação via API do cliente)*.
6.  Clique em **Implantar** e conceda as permissões de acesso ao script.
7.  Copie o **URL do aplicativo da web** gerado.

### Configurando a Conexão no Frontend
Abra o arquivo `src/config.js` do projeto frontend e insira o URL copiado:
```javascript
export const API_URL = "SUA_URL_DO_WEB_APP_DO_APPS_SCRIPT_AQUI";
```

---

## 📍 Geofencing e Janelas de Funcionamento

Para mitigar a possibilidade de fraudes de registros de frequência fora do local físico, o backend do script executa validações baseadas em tempo e espaço:

### 1. Cálculo da Distância (Fórmula de Haversine)
O script calcula a distância geodésica em metros de forma nativa a partir da latitude e longitude do dispositivo do usuário e do Terreiro:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1) \cos(\varphi_2) \sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
Se a distância obtida for maior que o raio tolerado, a linha de presença é marcada como `Fora do Raio` e os administradores são notificados na aba do Sheets.

### 2. Janelas Horárias Oficiais de Presença
O sistema possui regras rígidas que limitam o envio de presença apenas nos seguintes períodos configurados no backend:
*   **Turma de Sexta-feira**: Sexta das 18:00h até Sábado 02:00h da manhã.
*   **Turma de Sábado**: Sábado das 18:00h até as 23:00h.

---

## 🔒 Segurança e Boas Práticas

*   **Segurança CORS**: O backend do Apps Script está configurado para retornar headers CORS abertos (`Access-Control-Allow-Origin: *`) permitindo que aplicações Web e PWA hospedadas em plataformas de hospedagem rápida (ex: Hostinger, Vercel, Netlify) façam requisições sem erros.
*   **Armazenamento Local**: A sessão ativa do usuário (e-mail e permissão) é persistida de forma segura no `localStorage` do dispositivo para evitar a necessidade de logins recorrentes.
*   **Minificação**: A build de produção gerada pelo Vite automatiza a ofuscação de logs internos e otimiza assets para carregamento rápido mesmo sob conexões de internet 3G/4G instáveis.

---

## Configuração do WhatsApp (W-API)

Em **Configurações do projeto > Propriedades do script** do Apps Script, configure:

| Propriedade | Valor |
|---|---|
| `WAPI_INSTANCE_ID` | ID da instância W-API |
| `WAPI_TOKEN` | Token Bearer da instância |
| `WAPI_WEBHOOK_SECRET` | Segredo exclusivo com pelo menos 32 caracteres aleatórios |
| `WAPI_WEBHOOK_URL` | URL pública da implantação terminada em `/exec` (não `/dev`) |

Guarde tokens nas propriedades do Apps Script, fora do código e da planilha.
Publique uma nova versão na implantação atual, executando como proprietário, com acesso público para receber o webhook. Preserve a URL existente.
Com o número conectado à W-API, execute `configureWhatsAppReceivedWebhook()` e autorize os acessos solicitados. A função cria as abas `WhatsApp Usuários`, `WhatsApp Sessões` e `WhatsApp Eventos`, além da propriedade automática `WAPI_WEBHOOK_ACTIVATED_AT`.

O bot atende telefones previamente cadastrados na coluna `Telefone` de `WhatsApp Usuários`, com DDI. A pessoa informa um e-mail ativo e confirma o código recebido por e-mail. Para associar números que chegam somente como LID, marque `Ativar bot` na linha da pessoa: ela recebe um convite e responde `ATIVAR CÓDIGO` em até 24 horas, depois conclui a confirmação por e-mail.
Se o bot não responder, confira a implantação `/exec`, as propriedades e a aba `WhatsApp Eventos`. Após atualizar código do webhook, publique uma nova versão da implantação.

## Aniversários

As datas ficam em `Usuários!J`, no formato dia/mês. No mesmo projeto do Apps Script, execute `configurarGatilhoAniversariosTuig()` uma vez para ativar a rotina diária na faixa das 8h, no fuso da planilha. A função reutiliza o gatilho existente. `pausarAniversariosTuig()` pausa os avisos; `visualizarAniversariosHoje()` apenas consulta, sem enviar.

A rotina usa as credenciais W-API existentes e envia o resumo com os textos de parabéns por e-mail para `viniciusguerra19@icloud.com`. As propriedades opcionais permitem alterar os destinos:

- `ANIVERSARIOS_AVISO_EMAIL`: destinatário do resumo por e-mail.
- `ANIVERSARIOS_AVISO_TELEFONE`: telefone pessoal com país e DDD.
- `ANIVERSARIOS_GRUPO_SEXTA`, `ANIVERSARIOS_GRUPO_SABADO`, `ANIVERSARIOS_GRUPO_DOMINGO`: IDs de grupos no formato `...@g.us`.
- `ANIVERSARIOS_WAPI_INSTANCE_ID` e `ANIVERSARIOS_WAPI_TOKEN`: credenciais alternativas para uma instância dedicada.
- `ANIVERSARIOS_ATIVO`: `SIM` para permitir os envios.

Para atualizar os aniversários, substitua o conteúdo de `Aniversarios.gs` no Apps Script e salve. O gatilho diário usa o código salvo. Se houver tentativa sem confirmação, confira o relatório da execução e os destinos antes de reenviar.

## Acompanhamento e vínculos

A central **Acompanhamento** mostra mensalidades e presenças para conferir, com nome, turma, telefone e botão para abrir o WhatsApp com uma mensagem pronta. As presenças da mesma pessoa são reunidas em uma única mensagem. O telefone vem da aba `WhatsApp Usuários`, associado pelo e-mail, com país e DDD. Telefones ausentes ou ambíguos precisam ser corrigidos nessa aba. A tela permite buscar e filtrar turma, assunto e período; mensalidades continuam restritas à administração principal. O envio é concluído manualmente no WhatsApp. Os registros antigos de acompanhamento permanecem na planilha.

Em **Vínculos e saídas**, a administração principal pode afastar, reativar ou excluir cadastros. O aluno pode pedir afastamento ou exclusão em **Meu vínculo com o terreiro**. As alterações exigem código enviado ao e-mail de quem executa a ação. Afastamentos preservam o histórico e bloqueiam acesso; a exclusão remove os dados e anexos identificados após conferência e confirmação. Homônimos, empréstimos em aberto e arquivos compartilhados exigem resolução antes da exclusão. Cópias externas e históricos de versões do Google não são removidos por essa rotina.

## Arquivos locais e recuperação

`src/`, `public/`, `index.html` e a configuração do Vite compõem o site. Os três arquivos `.gs` são o código do Google Apps Script. `tests/` contém verificações de comportamento e testes de navegador. Execute `npm test` para os testes automatizados; os arquivos `*.browser.cjs` precisam de Playwright e do servidor local.

`node_modules/` contém as dependências instaladas e pode ser reconstruída com `npm ci`. `dist/` é gerada por `npm run build`; publique seu conteúdo no caminho `/sistema/` configurado no Vite. Ambas as pastas ficam fora do Git.

O GitHub guarda o código. Os dados da planilha, propriedades secretas, gatilhos e implantações permanecem na conta Google. Atualizar a pasta ou o GitHub não atualiza automaticamente o projeto do Apps Script nem o site publicado.

---

## 📄 Licença

Este projeto é de código aberto e está licenciado sob a licença **[MIT](LICENSE)**. Você está livre para copiar, modificar e utilizar o sistema para fins de gerenciamento e organização comunitária.

### Busca de capas e sinopses da biblioteca

No administrador, abra **Biblioteca → Livros → Cadastrar/Editar**. Preencha título e autor, ou informe o ISBN da edição, e escolha **Buscar capa e sinopse**. Os resultados mostram a fonte, idioma e dados da edição. **Usar capa** e **Usar sinopse** preenchem apenas o campo escolhido; confira a prévia e salve o livro.

A busca consulta Google Books e Open Library pelo navegador, sem chave configurada no cliente. Se um catálogo falhar ou exceder sua cota, o outro continua disponível. Há validação de ISBN, cancelamento ao mudar a pesquisa e limite de tempo das consultas. Descrições estrangeiras de edições do Open Library não são aplicadas como sinopses em português. Imagens indisponíveis usam a capa de identificação com título e autor.

Verificação: `npm test`, `npm run build` e `tests/library.browser.cjs` (Playwright; variável `PLAYWRIGHT_MODULE` quando necessário). O teste de navegador intercepta os serviços externos e usa dados fictícios, sem gravar na planilha. As alterações da interface precisam ser publicadas pelo fluxo de implantação acima para aparecerem no site.

### WhatsApp no acompanhamento

A central Acompanhamento usa o número da coluna O (`WhatsApp`) da aba `Usuários`. Cadastre com país e DDD (ex.: `+55 11 99999-9999`); números brasileiros de 10 ou 11 dígitos sem prefixo recebem o código 55. Para números internacionais, use `+` ou `00` antes do código do país.

As mensalidades são consultadas por intervalo, inicialmente de janeiro ao último mês encerrado. Cada pessoa tem um botão por assunto, reunindo os meses em aberto em uma mensagem e as datas sem presença em outra. O botão abre o WhatsApp com o texto pronto; o administrador revisa e envia. Pagamentos confirmados, isenções, comprovantes pendentes e períodos anteriores ao ingresso conhecido não entram na cobrança.
