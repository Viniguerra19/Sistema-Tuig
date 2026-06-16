# Sistema TUIG - Gestão de Rituais, Presenças e Agenda

Este é o repositório do **Sistema TUIG**, um aplicativo web PWA (Progressive Web App) desenvolvido para gerenciamento de atividades, frequências (presenças), rituais e justificativas de faltas de médiuns e administradores de terreiro.

O sistema opera com um frontend moderno e rápido e um backend integrado diretamente com planilhas do Google Sheets através do Google Apps Script.

---

## 🚀 Funcionalidades Principais

### 👤 Área do Aluno / Médium
- **Login Simplificado**: Autenticação prática apenas informando o e-mail cadastrado.
- **Registro de Presença por GPS (Geofencing)**: Registro de presença inteligente que valida se o usuário está fisicamente no local do terreiro (raio configurável de 25 metros) e dentro da janela de horários permitida.
- **Justificativa de Faltas**: Envio rápido de justificativas com motivos para datas em que o usuário esteve ausente, para posterior aprovação da administração.
- **Controle de Rituais**: Histórico de rituais realizados com contagem de dias passados e indicação de quando o próximo ritual estará disponível (intervalo padrão de 21 dias).
- **Histórico e Assiduidade**: Exibição da porcentagem de presença e histórico de todos os eventos com status formatado (Presente, Ausente, Abono/Justificativa).

### 🛠️ Painel Administrativo (Admin / Master Admin)
- **Dashboard de Estatísticas**: Visão geral de presença, total de médiuns ativos e contagem por turmas (Sexta e Sábado).
- **Ranking de Assiduidade**: Listagem ordenada com a porcentagem de comparecimento de todos os médiuns.
- **Chamada Manual (Registro em Massa)**: Opção de registrar presenças ou abonos manuais para turmas ou médiuns específicos em datas selecionadas.
- **Gráficos Integrados**: Visualização visual dos dados de assiduidade através do `Chart.js`.
- **Exportação**: Geração de relatórios em formato PDF das listas de presença.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 Customizado.
- **Build & Dev Server**: [Vite](https://vite.dev/) (rápido e leve).
- **Backend / Banco de Dados**: [Google Apps Script](https://developers.google.com/apps-script) + Google Sheets.
- **PWA (Progressive Web App)**: Service Workers configurados via `vite-plugin-pwa` e `Workbox` para suporte a instalação mobile offline.
- **Push Notifications**: Integração com o SDK da `OneSignal`.
- **Bibliotecas Visuais**: `Chart.js` para os gráficos e `html2pdf.js` para exportação de PDFs.

---

## 📦 Como Instalar e Executar o Projeto Localmente

### Pré-requisitos
Certifique-se de ter o **Node.js** (versão 18 ou superior) instalado em seu computador.

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/Viniguerra19/Sistema-Tuig.git
   cd Sistema-Tuig
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Configurar o Backend (opcional, veja abaixo):**
   Caso queira conectar o app a um novo banco de dados no Google Sheets, siga as instruções de configuração do backend e altere o arquivo `src/config.js`:
   ```javascript
   export const API_URL = "https://script.google.com/macros/s/SUA_API_URL/exec";
   ```

4. **Rodar em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Abra o endereço exibido no terminal (geralmente `http://localhost:5173`) no seu navegador.

5. **Compilar para Produção (Build):**
   ```bash
   npm run build
   ```
   Os arquivos finais otimizados serão gerados na pasta `dist/` para publicação na Hostinger, Vercel ou qualquer outro servidor estático.

---

## ☁️ Configurando o Backend no Google Sheets

O backend do aplicativo roda em um script no **Google Apps Script** conectado a uma Planilha Google.

1. **Criar a Planilha Google**: Crie uma planilha com as seguintes abas:
   - **`Usuários`**: Cadastro dos médiuns e administradores.
     * Colunas sugeridas: `Email`, `Nome`, `Permissão` (ex: `user`, `admin` ou `master_admin`), `Cursos`, `Áreas`, `Turma` (ex: `Sexta`, `Sábado`).
   - **`Rituais`**: Registro dos rituais.
     * Colunas sugeridas: `Email`, `Ritual`, `Data`, `Notas`.
   - **`Presenças`**: Log de presenças registradas.
     * Colunas sugeridas: `Data/Hora`, `Email`, `Nome`, `Registrado Por`, `Status GPS`, `ID do Dispositivo`.
   - **`Agenda`**: Calendário de giras e eventos.
     * Colunas sugeridas: `Data`, `Nome do Evento`, `Turma` (Sexta, Sábado, Geral).
   - **`Justificativas`**: Registro de faltas justificadas.
     * Colunas sugeridas: `Data Evento`, `Email`, `Nome`, `Motivo`, `Status` (Pendente, Aprovado, Rejeitado).

2. **Configurar o Apps Script**:
   - Na sua planilha, clique em **Extensões** -> **Apps Script**.
   - Apague todo o código existente e cole o conteúdo do arquivo `Code.gs` deste repositório.
   - Altere a constante `SPREADSHEET_ID` no topo do script para o ID da sua planilha (encontrado na URL dela).
   - Ajuste as coordenadas geográficas do terreiro em `TERREIRO_LAT` e `TERREIRO_LON` se necessário.

3. **Publicar como API (Web App)**:
   - No painel do Apps Script, clique em **Implantar** (Deploy) -> **Nova implantação**.
   - Selecione o tipo **App da Web**.
   - Configure:
     * *Executar como*: **Eu** (sua conta Google).
     * *Quem tem acesso*: **Qualquer pessoa** (necessário para que o aplicativo PWA acesse a API).
   - Clique em **Implantar**, autorize os acessos e copie o **URL do aplicativo da web** gerado.
   - Cole este URL no arquivo `src/config.js` do seu frontend.
