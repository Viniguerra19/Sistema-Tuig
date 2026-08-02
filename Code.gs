/**
 * Sistema de Gestão de Rituais - Google Apps Script (BACKEND API JSON)
 * Novo Backend: Retorna apenas JSON para ser consumido pelo App no Vercel/Hostinger
 */

const SPREADSHEET_ID = "1N8gsG2A99KI1f-DuoPYffTrvIqHzjDQb-5_voIu4QWc";
const SPREADSHEET_BIBLIOTECA_ID = "1bhpSOA8tI1qMP4hboQDjHPT5n9hGzt9l6BrWXU0ERZE";
const NOME_ABA_USUARIOS = "Usuários";
const NOME_ABA_RITUAIS = "Rituais";
const NOME_ABA_PRESENCAS = "Presenças";
const NOME_ABA_AGENDA = "Agenda";
const NOME_ABA_JUSTIFICATIVAS = "Justificativas";
const NOME_ABA_MENSALIDADES = "Mensalidades";
const NOME_ABA_LIVROS = "Livros";
const NOME_ABA_EMPRESTIMOS = "Empréstimos";

// Configurações do Terreiro
const TERREIRO_LAT = -23.48319550467122;
const TERREIRO_LON = -46.58630431299817;
const RAIO_TOLERANCIA_METROS = 25;

// Configurações CORS tratadas automaticamente pelo Google Apps Script em Web Apps.

/**
 * Função principal para servir a API REST (CORS Preflight)
 */
function doOptions(e) {
  return createJsonResponse({ status: "ok" });
}

/**
 * Rota principal GET da API
 * Exemplo: ?action=login&email=xyz
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    switch (action) {
      case 'login':
        return handleLogin(e.parameter.email);
      case 'getUserData':
        return handleGetUserData(e.parameter.email);
      case 'getAdminData':
         return handleGetAdminData(e.parameter.email);
      case 'getDashboardStats':
         return handleGetDashboardStats();
      case 'getBulkPresenceList':
         return handleGetBulkPresenceList(e.parameter.date, e.parameter.turma);
      case 'getRitualsReport':
         return handleGetRitualsReport(e.parameter.email);
      case 'getFinancialReport':
         return handleGetFinancialReport(e.parameter.email);
      case 'getBooksData':
         return handleGetBooksData(e.parameter.email);
      default:
        return createJsonResponse({ status: "error", message: "Ação não especificada ou inválida." }, 400);
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() }, 500);
  }
}

/**
 * Rota POST para gravar dados (ex: Presença)
 */
function doPost(e) {
  // O payload vem como texto no postData
  if (!e.postData || !e.postData.contents) {
     return createJsonResponse({ status: "error", message: "Corpo da requisição vazio." }, 400);
  }
  
  let payload;
  try {
     payload = JSON.parse(e.postData.contents);
  } catch (err) {
     return createJsonResponse({ status: "error", message: "Formato JSON inválido." }, 400);
  }

  const action = payload.action;
  
  try {
    switch (action) {
      case 'registerPresence':
        return handleRegisterPresence(payload.data);
      case 'sendJustification':
        return handleSendJustification(payload.data);
      case 'saveBulkPresence':
        return handleSaveBulkPresence(payload.data);
      case 'uploadReceipt':
        return handleUploadReceipt(payload.data);
      case 'verifyPayment':
        return handleVerifyPayment(payload.data);
      case 'setPaymentStatusManual':
        return handleSetPaymentStatusManual(payload.data);
      case 'saveBook':
        return handleSaveBook(payload.data);
      case 'deleteBook':
        return handleDeleteBook(payload.data);
      case 'requestBookLoan':
        return handleRequestBookLoan(payload.data);
      case 'cancelBookLoanRequest':
        return handleCancelBookLoanRequest(payload.data);
      case 'confirmBookPickup':
        return handleConfirmBookPickup(payload.data);
      case 'confirmBookReturn':
        return handleConfirmBookReturn(payload.data);
      default:
        return createJsonResponse({ status: "error", message: "Ação POST inválida." }, 400);
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() }, 500);
  }
}

function handleSendJustification(data) {
   if (!data || !data.email || !data.motivo || !data.nome || !data.dataEvento) {
      return createJsonResponse({ status: "error", message: "Dados incompletos para a justificativa." });
   }
   
   try {
     const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
     let sheet = ss.getSheetByName(NOME_ABA_JUSTIFICATIVAS);
     
     // Criar a aba se ela não existir
     if (!sheet) {
        sheet = ss.insertSheet(NOME_ABA_JUSTIFICATIVAS);
        sheet.appendRow(["Data Evento", "Email", "Nome", "Motivo", "Status"]);
        sheet.getRange("A1:E1").setFontWeight("bold");
     }
     
     // Insere a nova justificativa
     sheet.appendRow([data.dataEvento, data.email, data.nome, data.motivo, "Pendente"]);
     
     return createJsonResponse({ status: "success", message: "Justificativa registrada com sucesso!" });
   } catch (e) {
     return createJsonResponse({ status: "error", message: "Erro ao registrar justificativa: " + e.toString() });
   }
}

/**
 * Helper para criar respostas JSON com ContentService
 */
function createJsonResponse(data, statusCode = 200) {
    const output = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
    });
    
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// FUNÇÕES DE ROTAS (HANDLERS)
// ==========================================

function handleLogin(email) {
   if (!email) return createJsonResponse({ status: "error", message: "Email não fornecido." });
   const role = getUserRole(email);
   
   if (!role) {
      return createJsonResponse({ status: "error", message: "E-mail não encontrado ou sem permissão." });
   }
   
   return createJsonResponse({
      status: "success",
      data: { role: role }
   });
}

function handleGetUserData(email) {
   if (!email) return createJsonResponse({ status: "error", message: "Email não fornecido." });
   const data = getUserData(email);
   if (!data) return createJsonResponse({ status: "error", message: "Usuário não encontrado." });
   
   return createJsonResponse({ status: "success", data: data });
}

function handleGetAdminData(email) {
   if (!email) return createJsonResponse({ status: "error", message: "Email não fornecido." });
   const data = getAdminData(email);
   return createJsonResponse({ status: "success", data: data });
}

function handleGetDashboardStats() {
   const data = getDashboardStats();
   return createJsonResponse({ status: "success", data: data });
}

function handleRegisterPresence(presenceData) {
   if (!presenceData) return createJsonResponse({ status: "error", message: "Dados de presença ausentes." });
   const result = registerPresence(presenceData);
   return createJsonResponse(result); // O result já tem status e message
}

function handleGetBulkPresenceList(dateStr, turmaFilter) {
   if (!dateStr) return createJsonResponse({ status: "error", message: "Data não fornecida." });
   
   const filterNorm = turmaFilter ? turmaFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
   
   const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
   const userSheet = ss.getSheetByName(NOME_ABA_USUARIOS);
   const userData = userSheet.getDataRange().getValues();
   
   const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
   const presencesData = presenceSheet ? presenceSheet.getDataRange().getValues() : [];
   
   const partes = dateStr.split('-');
   const targetDateObj = new Date(partes[0], partes[1] - 1, partes[2]);
   const targetDateStr = targetDateObj.toLocaleDateString("pt-BR");
   
   const emailsPresentes = new Set();
   for (let i = 1; i < presencesData.length; i++) {
       const pDate = new Date(presencesData[i][0]);
       let adjustedPDate = new Date(pDate.getTime());
       if (adjustedPDate.getHours() < 2) {
           adjustedPDate.setHours(adjustedPDate.getHours() - 3);
       }
       if (adjustedPDate.toLocaleDateString("pt-BR") === targetDateStr) {
           emailsPresentes.add(presencesData[i][1].toString().toLowerCase().trim());
       }
   }
   
   let list = [];
   for (let i = 1; i < userData.length; i++) {
       const uEmail = userData[i][0].toString().toLowerCase().trim();
       if (!uEmail) continue;

       // Ignora usuários inativos (Coluna I - índice 8)
       const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
       if (status === "inativo") continue;
       
       const uNome = userData[i][1];
       const uTurma = userData[i][5] ? userData[i][5].toString() : "";
       const uTurmaNorm = uTurma.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
       
       let isRightTurma = false;
       if (!filterNorm || filterNorm === "geral" || filterNorm === "ambos" || filterNorm === "todos") {
           isRightTurma = true;
       } else if (uTurmaNorm.includes(filterNorm) || uTurmaNorm.includes("ambos")) {
           isRightTurma = true;
       }
       
       if (isRightTurma) {
           list.push({
               email: uEmail,
               nome: uNome,
               turma: uTurma,
               isPresent: emailsPresentes.has(uEmail)
           });
       }
   }
   
   list.sort((a, b) => a.nome.localeCompare(b.nome));
   return createJsonResponse({ status: "success", data: list });
}

function handleSaveBulkPresence(data) {
   if (!data || !data.date || !data.adminEmail || !data.presences || !Array.isArray(data.presences)) {
       return createJsonResponse({ status: "error", message: "Dados incompletos." });
   }
   
   try {
       const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
       const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
       if (!presenceSheet) return createJsonResponse({ status: "error", message: "Aba de presenças não encontrada." });
       
       const presencesData = presenceSheet.getDataRange().getValues();
       
       const partes = data.date.split('-');
       const targetDateObj = new Date(partes[0], partes[1] - 1, partes[2]);
       targetDateObj.setHours(12, 0, 0, 0); // Meio dia para evitar problemas de fuso
       const targetDateStr = targetDateObj.toLocaleDateString("pt-BR");
       
       const emailsPresentes = new Set();
       for (let i = 1; i < presencesData.length; i++) {
           const adjustedPDate = getAdjustedDate(presencesData[i][0]);
           if (adjustedPDate.toLocaleDateString("pt-BR") === targetDateStr) {
               emailsPresentes.add(presencesData[i][1].toString().toLowerCase().trim());
           }
       }
       
       let rowsAdded = 0;
       
       for (const student of data.presences) {
           const sEmail = student.email.toLowerCase().trim();
           if (student.isPresent && !emailsPresentes.has(sEmail)) {
               presenceSheet.appendRow([
                   targetDateObj,
                   sEmail,
                   student.nome,
                   "Admin: " + data.adminEmail,
                   "Abono em Massa / Chamada Manual",
                   "DEV-ADMIN"
               ]);
               rowsAdded++;
           }
       }
       
       return createJsonResponse({ status: "success", message: `Foram registradas ${rowsAdded} novas presenças!` });
   } catch (e) {
       return createJsonResponse({ status: "error", message: "Erro ao salvar em massa: " + e.toString() });
   }
}

// ==========================================
// LÓGICA DE NEGÓCIO (Reaproveitada)
// ==========================================

function getUserRole(email) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_ABA_USUARIOS);
  const data = sheet.getDataRange().getValues();
  const searchEmail = email.toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase().trim() === searchEmail) {
      // Verifica se o usuário está inativo (Coluna I - índice 8)
      const status = data[i][8] ? data[i][8].toString().toLowerCase().trim() : "";
      if (status === "inativo") return null;
      
      return data[i][2]; // Coluna C (Permissão)
    }
  }
  return null;
}

function getUserData(email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(NOME_ABA_USUARIOS);
  const ritualSheet = ss.getSheetByName(NOME_ABA_RITUAIS);
  
  const userData = userSheet.getDataRange().getValues();
  const ritualsData = ritualSheet.getDataRange().getValues();
  const searchEmail = email.toLowerCase().trim();
  
  let user = null;
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0].toString().toLowerCase().trim() === searchEmail) {
      // Verifica se o usuário está inativo (Coluna I - índice 8)
      const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
      if (status === "inativo") break;
      
      user = {
        email: userData[i][0],
        nome: userData[i][1],
        cursos: userData[i][3] ? userData[i][3].split(",").map(c => c.trim()) : [],
        turma: userData[i][5] ? userData[i][5].toString().trim() : ""
      };
      break;
    }
  }
  
  if (!user) return null;
  
  const mensalidadesSheet = ss.getSheetByName(NOME_ABA_MENSALIDADES);
  let userPayments = {};
  if (mensalidadesSheet) {
    const payData = mensalidadesSheet.getDataRange().getValues();
    const currentYear = new Date().getFullYear();
    const searchEmail = email.toLowerCase().trim();
    for (let i = 1; i < payData.length; i++) {
      const pEmail = payData[i][1].toString().toLowerCase().trim();
      const pYear = parseInt(payData[i][4]);
      if (pEmail === searchEmail && pYear === currentYear) {
        const pMonth = payData[i][3].toString();
        userPayments[pMonth] = {
          status: payData[i][7], // "Pendente", "Aprovado", "Rejeitado", "Pago"
          link: payData[i][5],
          obsAluno: payData[i][8] || "",
          obsAdmin: payData[i][9] || ""
        };
      }
    }
  }
  
  const hojeVal = new Date();
  const hoje = hojeVal.getTime();
  const diaSemana = hojeVal.getDay(); 
  
  // Verificação de Gira Geral na Agenda para liberar o botão
  const agendaSheet = ss.getSheetByName(NOME_ABA_AGENDA);
  let temGiraGeralHoje = false;
  if (agendaSheet) {
    const agendaData = agendaSheet.getDataRange().getValues();
    const hojeTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    for (let i = 1; i < agendaData.length; i++) {
      if (agendaData[i].length < 3) continue;
      const evtDate = new Date(agendaData[i][0]); // Coluna A
      if (isNaN(evtDate.getTime())) continue;
      const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
      const evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : ""; // Coluna C
      
      if (evtTime === hojeTime && (!evtTurma || evtTurma.includes("geral") || evtTurma.includes("ambos"))) {
        temGiraGeralHoje = true;
        break;
      }
    }
  }

  let canMarkPresence = false;
  let blockReason = "";
  const turmaNormalizada = user.turma.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const horaAtual = hojeVal.getHours();
  const tempoEmMinutos = (horaAtual * 60) + hojeVal.getMinutes();

  // Definição dos horários de presença de cada turma
  const isFridayNight = diaSemana === 5 && tempoEmMinutos >= 1080; // Sexta a partir de 18:00
  const isSaturdayEarlyMorning = diaSemana === 6 && tempoEmMinutos < 120; // Sábado até 01:59 (madrugada da Sexta)
  const isSextaWindow = isFridayNight || isSaturdayEarlyMorning;

  const isSabadoWindow = diaSemana === 6 && tempoEmMinutos >= 1080 && tempoEmMinutos < 1380; // Sábado das 18:00 às 22:59

  if (temGiraGeralHoje) {
    if (isSextaWindow || isSabadoWindow) {
        canMarkPresence = true;
    } else {
        blockReason = "A presença só é válida nos horários oficiais de gira (Sexta 18h às 02h ou Sábado 18h às 23h).";
    }
  } else if (turmaNormalizada.includes("sexta")) {
    if (isSextaWindow) {
        canMarkPresence = true;
    } else {
        blockReason = "O registro de presença para a turma de Sexta só é válido entre 18:00 e 02:00.";
    }
  } else if (turmaNormalizada.includes("sabado")) {
    if (isSabadoWindow) {
        canMarkPresence = true;
    } else {
        blockReason = "O registro de presença para a turma de Sábado só é válido aos sábados, das 18:00 às 23:00.";
    }
  } else {
    // Fallback para outras turmas
    if (isSextaWindow || isSabadoWindow) {
        canMarkPresence = true;
    } else {
        blockReason = "O registro está fora do horário permitido de funcionamento do terreiro.";
    }
  }
  
  const userRituals = ritualsData.filter(r => r[0].toString().toLowerCase().trim() === searchEmail).map(r => {
    const dataObj = r[2] instanceof Date ? r[2] : new Date(r[2]);
    const diffHoje = hoje - dataObj.getTime();
    const diasAtras = Math.floor(diffHoje / (1000 * 60 * 60 * 24));
    
    return {
      nome: r[1],
      data: dataObj.toISOString(),
      timestamp: dataObj.getTime(),
      diasAtras: diasAtras > 0 ? diasAtras + " dias atrás" : "Hoje",
      notas: r[3] || "",
      intervalo: ""
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
  
  // Regras de negócio para recomendação e elegibilidade de rituais agendados
  const completedNames = userRituals.map(r => r.nome.toLowerCase().trim());
  const hasAmaci = completedNames.some(n => n.includes("amaci") || n.includes("amaxi"));
  const hasBatizado = completedNames.some(n => n.includes("batizado"));
  const hasDeitada = completedNames.some(n => n.includes("deitada"));
  const hasEsquerda = completedNames.some(n => n.includes("esquerda"));
  const hasEntidade = completedNames.some(n => n.includes("entidade"));

  let deitadaDate = null;
  let esquerdaDate = null;

  userRituals.forEach(r => {
    const nome = r.nome.toLowerCase().trim();
    if (nome.includes("deitada")) {
      deitadaDate = new Date(r.timestamp);
    }
    if (nome.includes("esquerda")) {
      esquerdaDate = new Date(r.timestamp);
    }
  });

  const upcomingRituals = [];
  if (agendaSheet) {
    const agendaData = agendaSheet.getDataRange().getValues();
    const hojeTime = new Date(hojeVal.getFullYear(), hojeVal.getMonth(), hojeVal.getDate()).getTime();
    
    for (let i = 1; i < agendaData.length; i++) {
      if (agendaData[i].length <= 4) continue;
      const evtDate = new Date(agendaData[i][4]); // Coluna E
      if (isNaN(evtDate.getTime())) continue;
      const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
      
      if (evtTime >= hojeTime) {
        const evtNome = agendaData[i][5] ? agendaData[i][5].toString().trim() : ""; // Coluna F
        const evtNomeLower = evtNome.toLowerCase();
        
        let type = "";
        if (evtNomeLower.includes("amaci") || evtNomeLower.includes("amaxi")) type = "amaci";
        else if (evtNomeLower.includes("batizado")) type = "batizado";
        else if (evtNomeLower.includes("deitada")) type = "deitada";
        else if (evtNomeLower.includes("esquerda")) type = "esquerda";
        else if (evtNomeLower.includes("entidade")) type = "entidade";
        
        if (type) {
          upcomingRituals.push({
            nome: evtNome,
            data: evtDate.toISOString(),
            timestamp: evtTime,
            type: type
          });
        }
      }
    }
  }
  
  // Ordena por data mais próxima
  upcomingRituals.sort((a, b) => a.timestamp - b.timestamp);

  let recommendedRitual = null;
  for (let i = 0; i < upcomingRituals.length; i++) {
    const ritual = upcomingRituals[i];
    
    let completed = false;
    if (ritual.type === "amaci" && hasAmaci) completed = true;
    if (ritual.type === "batizado" && hasBatizado) completed = true;
    if (ritual.type === "deitada" && hasDeitada) completed = true;
    if (ritual.type === "esquerda" && hasEsquerda) completed = true;
    if (ritual.type === "entidade" && hasEntidade) completed = true;
    
    if (!completed) {
      let status = "eligible";
      let msg = "";
      
      if (ritual.type === "deitada") {
        if (!hasBatizado) {
          status = "blocked";
          msg = "Requer Batizado";
        }
      } else if (ritual.type === "esquerda") {
        if (!hasBatizado) {
          status = "blocked";
          msg = "Requer Batizado e 1 ano de Deitada";
        } else if (!hasDeitada) {
          status = "blocked";
          msg = "Requer Deitada (há pelo menos 1 ano)";
        } else {
          const diffDeitada = hoje - deitadaDate.getTime();
          const umAno = 365 * 24 * 60 * 60 * 1000;
          if (diffDeitada < umAno) {
            status = "blocked";
            const diasFaltando = Math.ceil((umAno - diffDeitada) / (1000 * 60 * 60 * 24));
            msg = `Requer 1 ano de Deitada (libera em ${diasFaltando} dias)`;
          }
        }
      } else if (ritual.type === "entidade") {
        if (!hasBatizado) {
          status = "blocked";
          msg = "Requer Batizado";
        } else if (!hasDeitada) {
          status = "blocked";
          msg = "Requer Deitada";
        } else if (!hasEsquerda) {
          status = "blocked";
          msg = "Requer Assentamento de Esquerda (há pelo menos 1 ano)";
        } else {
          const diffEsquerda = hoje - esquerdaDate.getTime();
          const umAno = 365 * 24 * 60 * 60 * 1000;
          if (diffEsquerda < umAno) {
            status = "blocked";
            const diasFaltando = Math.ceil((umAno - diffEsquerda) / (1000 * 60 * 60 * 24));
            msg = `Requer 1 ano de Assentamento de Esquerda (libera em ${diasFaltando} dias)`;
          }
        }
      }
      
      recommendedRitual = {
        nome: ritual.nome,
        data: ritual.data,
        type: ritual.type,
        status: status,
        mensagem: msg
      };
      break; 
    }
  }

  // Fallback legível para tempoParaProximo
  let tempoParaProximo = "Nenhum ritual agendado";
  if (recommendedRitual) {
    const diff = new Date(recommendedRitual.data).getTime() - hoje;
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const tempoFormatado = dias <= 0 ? "Hoje" : (dias === 1 ? "Amanhã" : "Em " + dias + " dias");
    tempoParaProximo = recommendedRitual.nome + ": " + (recommendedRitual.status === "eligible" ? tempoFormatado : "Bloqueado");
    recommendedRitual.tempoFormatado = tempoFormatado;
  }
  
  for (let i = 0; i < userRituals.length; i++) {
    if (i < userRituals.length - 1) {
      const diffTime = Math.abs(userRituals[i].timestamp - userRituals[i+1].timestamp);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      userRituals[i].intervalo = "Intervalo: " + diffDays + " dias";
    } else {
      userRituals[i].intervalo = "Primeiro registro";
    }
  }


  let eventHistory = [];
  let frequencyStats = { total: 0, present: 0, percentage: 0 };
  
  if (agendaSheet) {
    const agendaData = agendaSheet.getDataRange().getValues();
    const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
    const presencesData = presenceSheet ? presenceSheet.getDataRange().getValues() : [];
    
    const justifSheet = ss.getSheetByName(NOME_ABA_JUSTIFICATIVAS);
    const justifData = justifSheet ? justifSheet.getDataRange().getValues() : [];
    
    const eventosPassados = [];
    for (let i = 1; i < agendaData.length; i++) {
        if (agendaData[i].length < 3) continue;
        const evtDate = new Date(agendaData[i][0]); // Coluna A
        if (isNaN(evtDate.getTime())) continue;
        const evtNome = agendaData[i][1] ? agendaData[i][1].toString().trim() : ""; // Coluna B
        const evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : "ambos"; // Coluna C
        
        const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
        const hojeTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
        
        if (evtTime <= hojeTime) {
            let ehDaTurma = false;
            if (evtTurma === "ambos" || turmaNormalizada.includes("ambos")) ehDaTurma = true;
            else if (evtTurma.includes("sexta") && turmaNormalizada.includes("sexta")) ehDaTurma = true;
            else if (evtTurma.includes("sabado") && turmaNormalizada.includes("sabado")) ehDaTurma = true;
            
            if (ehDaTurma) {
                eventosPassados.push({ data: evtDate, nome: evtNome, rawDate: evtDate });
            }
        }
    }
    
    eventHistory = eventosPassados.map(evt => {
        const evtDateString = evt.data.toLocaleDateString("pt-BR");
        let isAbono = false;
        
        const estevePresente = presencesData.some(p => {
            const pEmail = p[1].toString().toLowerCase().trim();
            const pDate = p[0];
            const adjustedPDate = getAdjustedDate(pDate);
            
            if (pEmail === searchEmail && adjustedPDate.toLocaleDateString("pt-BR") === evtDateString) {
                return true;
            }
            return false;
        });

        // Caso ele não esteve presente, vamos ver se a justificativa foi aprovada
        if (!estevePresente && !isAbono && justifData.length > 1) {
             const justifFoiAprovada = justifData.some(j => {
                 const jDate = j[0]; // Em string DD/MM/YYYY ou Date 
                 let jDateStr = "";
                 if (jDate instanceof Date) {
                    jDateStr = jDate.toLocaleDateString("pt-BR");
                 } else {
                    jDateStr = jDate.toString(); // Ex: "06/03/2026"
                 }
                 const jEmail = j[1] ? j[1].toString().toLowerCase().trim() : "";
                 const jStatus = j[4] ? j[4].toString().toLowerCase().trim() : "";
                 
                 return jEmail === searchEmail && jDateStr === evtDateString && jStatus === "aprovado";
             });
             
             if (justifFoiAprovada) {
                 isAbono = true;
             }
        }
        
        let finalStatus = "Ausente";
        let finalCor = "danger";
        if (estevePresente) {
            if (isAbono) {
                finalStatus = "Abono";
                finalCor = "warning";
            } else {
                finalStatus = "Presente";
                finalCor = "success";
            }
        } else if (!estevePresente && isAbono) {
            // Abono vindo puramente da aba de Justificativas sem constar na aba presenças
            finalStatus = "Abono";
            finalCor = "warning";
        }
        
        return {
            data: evtDateString,
            rawDate: evt.rawDate,
            nome: evt.nome,
            status: finalStatus,
            cor: finalCor
        };
    }).sort((a, b) => { 
         const dateA = new Date(a.data.split('/').reverse().join('-'));
         const dateB = new Date(b.data.split('/').reverse().join('-'));
         return dateB - dateA;
    });
    
    frequencyStats.total = eventHistory.length;
    // Opcional: Considerar "Abono" como presença para não sujar a assiduidade!
    frequencyStats.present = eventHistory.filter(e => e.status === "Presente" || e.status === "Abono").length;
    frequencyStats.percentage = frequencyStats.total > 0 ? Math.round((frequencyStats.present / frequencyStats.total) * 100) : 0;
  }
  
  let presenceToday = false;
  const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
  if (presenceSheet) {
    const presencesData = presenceSheet.getDataRange().getValues();
    const hojeString = new Date().toLocaleDateString("pt-BR");
    
    // Para a madrugada (00:00 - 01:59), o "hoje" na verdade se refere ao dia anterior
    const hojeAjustado = getAdjustedDate(hojeVal);
    const hojeAjustadoString = hojeAjustado.toLocaleDateString("pt-BR");
    
    for (let i = 1; i < presencesData.length; i++) {
        const adjustedPDate = getAdjustedDate(presencesData[i][0]);
        const pDateString = adjustedPDate.toLocaleDateString("pt-BR");
        const pEmail = presencesData[i][1].toString().toLowerCase().trim();
        
        if (pEmail === searchEmail && (pDateString === hojeString || pDateString === hojeAjustadoString)) {
            presenceToday = true;
            break;
        }
    }
  }

  return {
    user: user,
    rituals: userRituals,
    eventHistory: eventHistory,
    frequencyStats: frequencyStats,
    tempoParaProximo: tempoParaProximo,
    proximoRitual: recommendedRitual,
    presenceToday: presenceToday,
    canMarkPresence: canMarkPresence,
    blockReason: blockReason,
    payments: userPayments
  };
}

function getAdminData(adminEmail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(NOME_ABA_USUARIOS);
  const userData = userSheet.getDataRange().getValues();
  
  const searchAdminEmail = adminEmail.toLowerCase().trim();
  let adminInfo = null;

  for (let i = 1; i < userData.length; i++) {
    const emailInSheet = userData[i][0].toString().toLowerCase().trim();
    if (emailInSheet === searchAdminEmail) {
      adminInfo = {
        role: userData[i][2],
        areas: userData[i][4] ? userData[i][4].toString().split(",").map(a => a.toLowerCase().trim()) : []
      };
      break;
    }
  }

  if (!adminInfo) return [];
  
  let filteredUsers = [];
  
  for (let i = 1; i < userData.length; i++) {
    const userEmailInSheet = userData[i][0].toString().toLowerCase().trim();
    if (!userEmailInSheet) continue;

    // Ignora usuários inativos (Coluna I - índice 8)
    const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
    if (status === "inativo") continue;

    const userCursosRaw = userData[i][3] ? userData[i][3].toString().split(",").map(c => c.trim()) : [];
    const userCursosLower = userCursosRaw.map(c => c.toLowerCase().trim());
    
    if (adminInfo.role === "master_admin") {
      filteredUsers.push({
        email: userData[i][0],
        nome: userData[i][1],
        cursos: userCursosRaw,
        turma: userData[i][5] ? userData[i][5].toString().trim() : ""
      });
    } else if (adminInfo.role === "admin") {
      const temInterseccao = userCursosLower.some(curso => adminInfo.areas.includes(curso));
      
      if (temInterseccao) {
        const cursosVisiveis = userCursosRaw.filter(c => 
          adminInfo.areas.includes(c.toLowerCase().trim())
        );
        
        filteredUsers.push({
          email: userData[i][0],
          nome: userData[i][1],
          cursos: cursosVisiveis,
          turma: userData[i][5] ? userData[i][5].toString().trim() : ""
        });
      }
    }
  }
  
  return filteredUsers;
}

function registerPresence(presenceData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
  
  if (!presenceSheet) {
    return { status: "error", message: "Aba 'Presenças' não encontrada no servidor." };
  }

  const { studentEmail, registeredBy, lat, lon, deviceId } = presenceData;
  
  const userData = ss.getSheetByName(NOME_ABA_USUARIOS).getDataRange().getValues();
  let studentName = "Não cadastrado";
  let isActive = true;
  for(let i=1; i < userData.length; i++) {
    if(userData[i][0].toString().toLowerCase().trim() === studentEmail.toLowerCase().trim()) {
      const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
      if (status === "inativo") {
        isActive = false;
      } else {
        studentName = userData[i][1];
      }
      break;
    }
  }

  if (!isActive || studentName === "Não cadastrado") {
    return { status: "error", message: "Este aluno está inativo ou não cadastrado no sistema." };
  }

  const presencesData = presenceSheet.getDataRange().getValues();
  const hoje = new Date();
  const hojeString = hoje.toLocaleDateString("pt-BR");

  for (let i = 1; i < presencesData.length; i++) {
    const pDate = new Date(presencesData[i][0]);
    const pDateString = pDate.toLocaleDateString("pt-BR");
    const pEmail = presencesData[i][1].toString().toLowerCase().trim();
    
      if (pEmail === studentEmail.toLowerCase().trim() && pDateString === hojeString) {
      return { 
        status: "error", 
        message: "Presença já registrada hoje para este aluno!" 
      };
    }
  }

  // Validação de horários no backend (Sexta 18h às 02h e Sábado 18h às 23h)
  const horaVal = new Date();
  const diaSemanaVal = horaVal.getDay();
  const horaValAtual = horaVal.getHours();
  const minutoValAtual = horaVal.getMinutes();
  const tempoEmMinutosVal = (horaValAtual * 60) + minutoValAtual;
  
  const isFridayNightVal = diaSemanaVal === 5 && tempoEmMinutosVal >= 1080;
  const isSaturdayEarlyMorningVal = diaSemanaVal === 6 && tempoEmMinutosVal < 120;
  const isSabadoWindowVal = diaSemanaVal === 6 && tempoEmMinutosVal >= 1080 && tempoEmMinutosVal < 1380;
  
  if (!isFridayNightVal && !isSaturdayEarlyMorningVal && !isSabadoWindowVal) {
    return {
      status: "error",
      message: "A presença só será validada durante os horários de gira (Sexta 18h às 02h ou Sábado 18h às 23h)."
    };
  }

  const distance = calculateDistance(lat, lon, TERREIRO_LAT, TERREIRO_LON);
  const withinRadius = distance <= RAIO_TOLERANCIA_METROS;
  const statusGPS = withinRadius ? "Dentro do Raio" : "Fora do Raio (" + Math.round(distance) + "m)";

  presenceSheet.appendRow([
    new Date(),
    studentEmail,
    studentName,
    registeredBy,
    statusGPS,
    deviceId
  ]);

  return {
    status: "success",
    message: withinRadius ? "Presença confirmada!" : "Presença registrada (Atenção: Fora do raio permitido)",
    withinRadius: withinRadius
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getDashboardStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const userSheet = ss.getSheetByName(NOME_ABA_USUARIOS);
  const userData = userSheet.getDataRange().getValues();
  let statsTurma = { total: 0, sexta: 0, sabado: 0 };
  let rankingMediuns = {};
  
  for (let i = 1; i < userData.length; i++) {
    const email = userData[i][0].toString().toLowerCase().trim();
    if (!email) continue;
    
    // Ignora usuários inativos (Coluna I - índice 8)
    const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
    if (status === "inativo") continue;
    
    statsTurma.total++;
    let turmaRaw = userData[i][5] ? userData[i][5].toString().toLowerCase().trim() : "";
    
    rankingMediuns[email] = {
      nome: userData[i][1],
      turma: turmaRaw,
      esperados: 0,
      presencas: 0,
      porcentagem: 0
    };
    
    if (turmaRaw.includes("sexta")) statsTurma.sexta++;
    else if (turmaRaw.includes("sabado")) statsTurma.sabado++;
  }
  
  const agendaSheet = ss.getSheetByName(NOME_ABA_AGENDA);
  let eventosMapeados = []; 
  let presencasPorData = {};
  
  if (agendaSheet) {
    const agendaData = agendaSheet.getDataRange().getValues();
    const hojeTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    
    for (let i = 1; i < agendaData.length; i++) {
      if (agendaData[i].length < 3) continue;
      const evtDate = new Date(agendaData[i][0]); // Coluna A
      if (isNaN(evtDate.getTime())) continue;
      const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
      
      if (evtTime <= hojeTime) {
        let evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : "ambos"; // Coluna C
        let dateString = evtDate.toLocaleDateString("pt-BR");
        
        let expected = 0;
        if (evtTurma.includes("sexta")) {
           expected = statsTurma.sexta;
        } else if (evtTurma.includes("sabado")) {
           expected = statsTurma.sabado;
        } else {
           expected = statsTurma.total;
        }
        
        eventosMapeados.push({
          data: dateString,
          turma: evtTurma,
          timestamp: evtTime,
          expected: expected
        });
        
        presencasPorData[dateString] = { count: 0 };
        
        for (let medEmail in rankingMediuns) {
            let mTurma = rankingMediuns[medEmail].turma;
            let deveParticipar = false;
            if (evtTurma.includes("sexta") && mTurma.includes("sexta")) deveParticipar = true;
            else if (evtTurma.includes("sabado") && mTurma.includes("sabado")) deveParticipar = true;
            else if (!evtTurma.includes("sexta") && !evtTurma.includes("sabado")) deveParticipar = true; // Evento geral
            
            if (deveParticipar) {
                rankingMediuns[medEmail].esperados++;
            }
        }
      }
    }
  }
  
  eventosMapeados.sort((a, b) => a.timestamp - b.timestamp);
  
  const presenceSheet = ss.getSheetByName(NOME_ABA_PRESENCAS);
  const userPresences = new Set();
  
  if (presenceSheet) {
    const presencesData = presenceSheet.getDataRange().getValues();
    
    for (let i = 1; i < presencesData.length; i++) {
      const adjustedPDate = getAdjustedDate(presencesData[i][0]);
      const pDateString = adjustedPDate.toLocaleDateString("pt-BR");
      const pEmail = presencesData[i][1].toString().toLowerCase().trim();
      
      if (presencasPorData[pDateString]) {
        presencasPorData[pDateString].count++;
      }
      
      if (rankingMediuns[pEmail]) {
        rankingMediuns[pEmail].presencas++;
      }
      
      userPresences.add(pEmail + "_" + pDateString);
    }
  }

  // Buscar justificativas aprovadas
  const userAbonos = new Set();
  const justifSheet = ss.getSheetByName(NOME_ABA_JUSTIFICATIVAS);
  if (justifSheet) {
    const justifData = justifSheet.getDataRange().getValues();
    for (let i = 1; i < justifData.length; i++) {
      const jDate = justifData[i][0];
      let jDateStr = "";
      if (jDate instanceof Date) {
        jDateStr = jDate.toLocaleDateString("pt-BR");
      } else {
        jDateStr = jDate.toString();
      }
      const jEmail = justifData[i][1] ? justifData[i][1].toString().toLowerCase().trim() : "";
      const jStatus = justifData[i][4] ? justifData[i][4].toString().toLowerCase().trim() : "";
      
      if (jStatus === "aprovado") {
        userAbonos.add(jEmail + "_" + jDateStr);
      }
    }
  }

  // Calcular faltas e preencher array de pessoas com mais de 3 faltas
  let arrMaisDeTresFaltas = [];
  for (let email in rankingMediuns) {
    const m = rankingMediuns[email];
    const mTurma = m.turma;
    let totalFaltas = 0;
    
    for (let evt of eventosMapeados) {
      let deveParticipar = false;
      if (evt.turma.includes("sexta") && mTurma.includes("sexta")) deveParticipar = true;
      else if (evt.turma.includes("sabado") && mTurma.includes("sabado")) deveParticipar = true;
      else if (!evt.turma.includes("sexta") && !evt.turma.includes("sabado")) deveParticipar = true;
      
      if (deveParticipar) {
        const key = email + "_" + evt.data;
        const estevePresente = userPresences.has(key);
        const temAbono = userAbonos.has(key);
        
        if (!estevePresente && !temAbono) {
          totalFaltas++;
        }
      }
    }
    
    m.faltas = totalFaltas;
    
    if (totalFaltas > 3) {
      arrMaisDeTresFaltas.push({
        nome: m.nome,
        email: email,
        turma: m.turma,
        faltas: totalFaltas
      });
    }
  }
  
  // Ordenar o alerta por maior número de faltas decrescente
  arrMaisDeTresFaltas.sort((a, b) => b.faltas - a.faltas);
  
  let arrRanking = [];
  for (let email in rankingMediuns) {
    let m = rankingMediuns[email];
    if (m.esperados > 0) {
        m.porcentagem = Math.round((m.presencas / m.esperados) * 100);
        if (m.porcentagem > 100) m.porcentagem = 100;
        arrRanking.push(m);
    }
  }
  
  arrRanking.sort((a, b) => b.porcentagem - a.porcentagem);
  let topAssiduos = arrRanking.slice(0, 5);
  
  arrRanking.sort((a, b) => a.porcentagem - b.porcentagem);
  let topAusentes = arrRanking.slice(0, 5);
  
  
  let sextaEsperado = 0, sextaReal = 0;
  let sabadoEsperado = 0, sabadoReal = 0;
  let geralEsperado = 0, geralReal = 0;
  
  let labelsEvolucao = [];
  let dataEvolucao = [];
  
  let recentes = eventosMapeados.slice(-10);
  for (let evt of recentes) {
    let pCount = presencasPorData[evt.data]?.count || 0;
    
    const partesData = evt.data.split('/');
    labelsEvolucao.push(partesData[0] + '/' + partesData[1]);
    
    let percentage = evt.expected > 0 ? Math.round((pCount / evt.expected) * 100) : 0;
    if (percentage > 100) percentage = 100;
    dataEvolucao.push(percentage);
    
    if (evt.turma.includes("sexta")) {
      sextaEsperado += evt.expected;
      sextaReal += pCount;
    } else if (evt.turma.includes("sabado")) {
      sabadoEsperado += evt.expected;
      sabadoReal += pCount;
    } else {
      geralEsperado += evt.expected;
      geralReal += pCount;
    }
  }
  
  let assiduidadeSexta = sextaEsperado > 0 ? Math.round((sextaReal / sextaEsperado) * 100) : 0;
  let assiduidadeSabado = sabadoEsperado > 0 ? Math.round((sabadoReal / sabadoEsperado) * 100) : 0;
  
  let totalEsperadoGlobal = sextaEsperado + sabadoEsperado + geralEsperado;
  let totalRealGlobal = sextaReal + sabadoReal + geralReal;
  let mediaGeral = totalEsperadoGlobal > 0 ? Math.round((totalRealGlobal / totalEsperadoGlobal) * 100) : 0;
  
  if (assiduidadeSexta > 100) assiduidadeSexta = 100;
  if (assiduidadeSabado > 100) assiduidadeSabado = 100;
  if (mediaGeral > 100) mediaGeral = 100;

  return {
    kpis: {
      totalMediuns: statsTurma.total,
      assiduidadeGeral: mediaGeral,
      textoAssiduidade: totalEsperadoGlobal > 0 ? "Últimos eventos" : "Sem dados"
    },
    barChart: {
      sexta: assiduidadeSexta,
      sabado: assiduidadeSabado
    },
    lineChart: {
      labels: labelsEvolucao,
      data: dataEvolucao
    },
    ranking: {
        assiduos: topAssiduos,
        ausentes: topAusentes,
        maisDeTresFaltas: arrMaisDeTresFaltas
    }
  };
}

function handleGetRitualsReport(requesterEmail) {
  if (!requesterEmail) {
    return createJsonResponse({ status: "error", message: "Email do solicitante não fornecido." }, 400);
  }
  
  const role = getUserRole(requesterEmail);
  const emailClean = requesterEmail.toLowerCase().trim();
  const isAllowedSpecial = emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";
  
  if (role !== 'master_admin' && !isAllowedSpecial) {
    return createJsonResponse({ status: "error", message: "Acesso negado. Apenas master_admin ou administradores autorizados podem acessar relatórios de rituais." }, 403);
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(NOME_ABA_USUARIOS);
    const ritualSheet = ss.getSheetByName(NOME_ABA_RITUAIS);
    
    if (!userSheet) return createJsonResponse({ status: "error", message: "Aba de usuários não encontrada." });
    if (!ritualSheet) return createJsonResponse({ status: "error", message: "Aba de rituais não encontrada." });
    
    const userData = userSheet.getDataRange().getValues();
    const ritualsData = ritualSheet.getDataRange().getValues();
    
    // Mapeia emails para seus rituais
    const userRitualsMap = {};
    for (let i = 1; i < ritualsData.length; i++) {
      const email = ritualsData[i][0].toString().toLowerCase().trim();
      if (!email) continue;
      const ritualName = ritualsData[i][1].toString().trim();
      const ritualDate = ritualsData[i][2];
      const ritualNotes = ritualsData[i][3] || "";
      
      let dateStr = "";
      if (ritualDate instanceof Date) {
        dateStr = ritualDate.toISOString();
      } else if (ritualDate) {
        let parsedDate = new Date(ritualDate);
        if (isNaN(parsedDate.getTime())) {
          const partes = ritualDate.toString().split('/');
          if (partes.length === 3) {
            parsedDate = new Date(partes[2], partes[1] - 1, partes[0]);
          }
        }
        dateStr = isNaN(parsedDate.getTime()) ? ritualDate.toString() : parsedDate.toISOString();
      }
      
      if (!userRitualsMap[email]) {
        userRitualsMap[email] = [];
      }
      userRitualsMap[email].push({
        nome: ritualName,
        data: dateStr,
        notas: ritualNotes
      });
    }
    
    const reportData = [];
    for (let i = 1; i < userData.length; i++) {
      const email = userData[i][0].toString().toLowerCase().trim();
      if (!email) continue;

      // Ignora usuários inativos (Coluna I - índice 8)
      const status = userData[i][8] ? userData[i][8].toString().toLowerCase().trim() : "";
      if (status === "inativo") continue;

      const nome = userData[i][1].toString().trim();
      const turma = userData[i][5] ? userData[i][5].toString().trim() : "";
      const userRole = userData[i][2] ? userData[i][2].toString().trim() : "user";
      
      reportData.push({
        email: userData[i][0].toString().trim(),
        nome: nome,
        turma: turma,
        role: userRole,
        rituals: userRitualsMap[email] || []
      });
    }
    
    const uniqueRituals = [];
    const seenRituals = new Set();
    for (let i = 1; i < ritualsData.length; i++) {
      const rName = ritualsData[i][1].toString().trim();
      if (rName && !seenRituals.has(rName)) {
        seenRituals.add(rName);
        uniqueRituals.push(rName);
      }
    }
    uniqueRituals.sort();
    
    return createJsonResponse({
      status: "success",
      data: {
        users: reportData,
        uniqueRituals: uniqueRituals
      }
    });
  } catch (error) {
    return createJsonResponse({ status: "error", message: "Erro ao gerar relatório: " + error.toString() }, 500);
  }
}

// ==========================================
// FUNÇÕES DE CONTROLE FINANCEIRO (MENSALIDADES)
// ==========================================

function getMensalidadesSheet(ss) {
  let sheet = ss.getSheetByName(NOME_ABA_MENSALIDADES);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_ABA_MENSALIDADES);
    sheet.appendRow([
      "Timestamp", 
      "Email", 
      "Nome", 
      "Mês", 
      "Ano", 
      "Comprovante Link", 
      "Drive File ID", 
      "Status", 
      "Observações Aluno", 
      "Observações Admin", 
      "Verificado Por", 
      "Data Verificação"
    ]);
    sheet.getRange("A1:L1").setFontWeight("bold");
  }
  return sheet;
}

function findPaymentRowIndex(sheet, email, mes, ano) {
  const data = sheet.getDataRange().getValues();
  const searchEmail = email.toLowerCase().trim();
  const searchMes = mes.toString().trim();
  const searchAno = ano.toString().trim();
  
  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][1].toString().toLowerCase().trim();
    const rowMes = data[i][3].toString().trim();
    const rowAno = data[i][4].toString().trim();
    if (rowEmail === searchEmail && rowMes === searchMes && rowAno === searchAno) {
      return i + 1; // 1-indexed
    }
  }
  return -1;
}

function handleUploadReceipt(data) {
  const { email, nome, mes, ano, fileBase64, fileName, mimeType, obs } = data;
  
  if (!email || !mes || !ano || !fileBase64 || !fileName || !mimeType) {
    return createJsonResponse({ status: "error", message: "Dados incompletos para envio do comprovante." });
  }
  
  try {
    let base64Part = fileBase64;
    if (fileBase64.indexOf("base64,") !== -1) {
      base64Part = fileBase64.split("base64,")[1];
    }
    const decoded = Utilities.base64Decode(base64Part);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    const folderName = "Comprovantes TUIG";
    const folders = DriveApp.getFoldersByName(folderName);
    let mainFolder;
    if (folders.hasNext()) {
      mainFolder = folders.next();
    } else {
      mainFolder = DriveApp.createFolder(folderName);
    }
    
    // Localiza ou cria a pasta com o nome do aluno dentro de "Comprovantes TUIG"
    const studentFolderName = nome.trim();
    const studentFolders = mainFolder.getFoldersByName(studentFolderName);
    let targetFolder;
    if (studentFolders.hasNext()) {
      targetFolder = studentFolders.next();
    } else {
      targetFolder = mainFolder.createFolder(studentFolderName);
    }
    
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMensalidadesSheet(ss);
    const rowIndex = findPaymentRowIndex(sheet, email, mes, ano);
    
    if (rowIndex > 0) {
      // Deleta o arquivo antigo do Drive para não acumular lixo
      const oldFileId = sheet.getRange(rowIndex, 7).getValue().toString().trim();
      deleteFileFromDrive(oldFileId);
      
      sheet.getRange(rowIndex, 1).setValue(new Date()); // Update Timestamp
      sheet.getRange(rowIndex, 3).setValue(nome);       // Garante nome atualizado
      sheet.getRange(rowIndex, 6).setValue(fileUrl);    // Novo Link
      sheet.getRange(rowIndex, 7).setValue(fileId);     // Novo File ID
      sheet.getRange(rowIndex, 8).setValue("Pendente"); // Reseta para Pendente
      sheet.getRange(rowIndex, 9).setValue(obs || "");  // Observações do Aluno
      sheet.getRange(rowIndex, 10).setValue("");        // Limpa notas do admin
      sheet.getRange(rowIndex, 11).setValue("");        // Limpa validador
      sheet.getRange(rowIndex, 12).setValue("");        // Limpa data de verificação
    } else {
      sheet.appendRow([
        new Date(),
        email.toLowerCase().trim(),
        nome,
        mes,
        ano,
        fileUrl,
        fileId,
        "Pendente",
        obs || "",
        "",
        "",
        ""
      ]);
    }
    
    return createJsonResponse({ status: "success", message: "Comprovante enviado com sucesso!" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao salvar comprovante: " + err.toString() });
  }
}

function handleVerifyPayment(data) {
  const { adminEmail, studentEmail, mes, ano, status, obs } = data;
  
  if (!adminEmail || !studentEmail || !mes || !ano || !status) {
    return createJsonResponse({ status: "error", message: "Dados incompletos para validação." });
  }
  
  const role = getUserRole(adminEmail);
  if (role !== "master_admin" && role !== "admin") {
    return createJsonResponse({ status: "error", message: "Acesso negado. Apenas administradores podem validar comprovantes." }, 403);
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMensalidadesSheet(ss);
    const rowIndex = findPaymentRowIndex(sheet, studentEmail, mes, ano);
    
    if (rowIndex === -1) {
      return createJsonResponse({ status: "error", message: "Registro do comprovante não encontrado." });
    }
    
    sheet.getRange(rowIndex, 8).setValue(status);
    sheet.getRange(rowIndex, 10).setValue(obs || "");
    sheet.getRange(rowIndex, 11).setValue(adminEmail);
    sheet.getRange(rowIndex, 12).setValue(new Date());
    
    if (status === "Rejeitado") {
      // Se rejeitar o comprovante, deleta o arquivo do Drive para evitar arquivos mortos
      const fileId = sheet.getRange(rowIndex, 7).getValue().toString().trim();
      deleteFileFromDrive(fileId);
      
      // Limpa os campos de comprovante na planilha
      sheet.getRange(rowIndex, 6).setValue("");
      sheet.getRange(rowIndex, 7).setValue("");
    }
    
    return createJsonResponse({ status: "success", message: `Pagamento verificado com status: ${status}` });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao salvar verificação: " + err.toString() });
  }
}

function handleSetPaymentStatusManual(data) {
  const { adminEmail, studentEmail, nome, mes, ano, status } = data;
  
  if (!adminEmail || !studentEmail || !mes || !ano || !status) {
    return createJsonResponse({ status: "error", message: "Dados incompletos para ajuste manual." });
  }
  
  const role = getUserRole(adminEmail);
  if (role !== "master_admin" && role !== "admin") {
    return createJsonResponse({ status: "error", message: "Acesso negado." }, 403);
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMensalidadesSheet(ss);
    const rowIndex = findPaymentRowIndex(sheet, studentEmail, mes, ano);
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 8).setValue(status);
      sheet.getRange(rowIndex, 11).setValue(adminEmail);
      sheet.getRange(rowIndex, 12).setValue(new Date());
      if (status === "Em Aberto") {
        // Se retornar para Em Aberto, deleta o arquivo do Drive para evitar arquivos mortos
        const fileId = sheet.getRange(rowIndex, 7).getValue().toString().trim();
        deleteFileFromDrive(fileId);
        
        sheet.getRange(rowIndex, 6).setValue("");
        sheet.getRange(rowIndex, 7).setValue("");
        sheet.getRange(rowIndex, 9).setValue("");
        sheet.getRange(rowIndex, 10).setValue("");
      }
    } else {
      if (status === "Pago") {
        sheet.appendRow([
          new Date(),
          studentEmail.toLowerCase().trim(),
          nome,
          mes,
          ano,
          "", // Sem Link do Drive
          "", // Sem File ID
          "Pago",
          "Marcação manual pelo admin", // Obs Aluno
          "", // Obs Admin
          adminEmail,
          new Date()
        ]);
      }
    }
    
    return createJsonResponse({ status: "success", message: "Status do pagamento atualizado com sucesso!" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao salvar ajuste manual: " + err.toString() });
  }
}

function handleGetFinancialReport(adminEmail) {
  if (!adminEmail) {
    return createJsonResponse({ status: "error", message: "Email do administrador não fornecido." }, 400);
  }
  
  const role = getUserRole(adminEmail);
  if (role !== "master_admin" && role !== "admin") {
    return createJsonResponse({ status: "error", message: "Acesso negado." }, 403);
  }
  
  try {
    const visibleUsers = getAdminData(adminEmail);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getMensalidadesSheet(ss);
    const payData = sheet.getDataRange().getValues();
    const currentYear = new Date().getFullYear();
    
    const paymentsMap = {};
    const pendingList = [];
    
    for (let i = 1; i < payData.length; i++) {
      const pEmail = payData[i][1].toString().toLowerCase().trim();
      const pYear = parseInt(payData[i][4]);
      if (pYear === currentYear) {
        const pMonth = payData[i][3].toString();
        const pStatus = payData[i][7];
        const pLink = payData[i][5];
        const pObsAluno = payData[i][8] || "";
        const pObsAdmin = payData[i][9] || "";
        const pNome = payData[i][2];
        
        if (!paymentsMap[pEmail]) {
          paymentsMap[pEmail] = {};
        }
        paymentsMap[pEmail][pMonth] = {
          status: pStatus,
          link: pLink,
          obsAluno: pObsAluno,
          obsAdmin: pObsAdmin
        };
        
        if (pStatus === "Pendente") {
          pendingList.push({
            email: pEmail,
            nome: pNome,
            mes: pMonth,
            ano: pYear,
            link: pLink,
            obsAluno: pObsAluno
          });
        }
      }
    }
    
    const reportUsers = visibleUsers.map(u => {
      const emailLower = u.email.toLowerCase().trim();
      return {
        email: u.email,
        nome: u.nome,
        turma: u.turma,
        payments: paymentsMap[emailLower] || {}
      };
    });
    
    return createJsonResponse({
      status: "success",
      data: {
        users: reportUsers,
        pending: pendingList
      }
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao buscar relatório financeiro: " + err.toString() }, 500);
  }
}



/**
 * Deleta um arquivo do Drive com base no seu ID (move para a lixeira do Drive)
 */
function deleteFileFromDrive(fileId) {
  if (!fileId) return;
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    Logger.log("Arquivo movido para a lixeira: " + fileId);
  } catch (e) {
    Logger.log("Erro ao deletar arquivo do Drive: " + e.toString());
  }
}

/**
 * Ajusta fuso horário de datas gravadas na madrugada (entre 00:00 e 01:59) recuando 3 horas
 */
function getAdjustedDate(date) {
  const d = new Date(date);
  if (!isNaN(d.getTime()) && d.getHours() < 2) {
    d.setHours(d.getHours() - 3);
  }
  return d;
}

// ==========================================
// SISTEMA DE BIBLIOTECA E EMPRÉSTIMOS
// ==========================================

function checkAndInitLibrarySheets(ss) {
  let livrosSheet = ss.getSheetByName(NOME_ABA_LIVROS);
  if (!livrosSheet) {
    livrosSheet = ss.insertSheet(NOME_ABA_LIVROS);
    livrosSheet.appendRow(["ID", "Título", "Autor", "Sinopse", "CapaURL", "Localização", "QtdTotal", "QtdDisponivel", "Ativo", "Categoria"]);
    livrosSheet.getRange("A1:J1").setFontWeight("bold");
  } else {
    // Garante que o cabeçalho 'Categoria' existe na coluna J se a planilha já foi criada antes
    const headers = livrosSheet.getRange("A1:J1").getValues()[0];
    if (headers[8] === "Ativo" && (!headers[9] || headers[9] !== "Categoria")) {
      livrosSheet.getRange("J1").setValue("Categoria").setFontWeight("bold");
    }
  }
  
  let emprestimosSheet = ss.getSheetByName(NOME_ABA_EMPRESTIMOS);
  if (!emprestimosSheet) {
    emprestimosSheet = ss.insertSheet(NOME_ABA_EMPRESTIMOS);
    emprestimosSheet.appendRow(["ID", "LivroID", "TítuloLivro", "Email", "Nome", "DataSolicitacao", "DataRetirada", "DataDevolucaoPrevista", "DataDevolucaoReal", "Status"]);
    emprestimosSheet.getRange("A1:J1").setFontWeight("bold");
  }
  
  return { livrosSheet, emprestimosSheet };
}

function handleGetBooksData(email) {
  if (!email) return createJsonResponse({ status: "error", message: "Email não fornecido." });
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet, emprestimosSheet } = checkAndInitLibrarySheets(ss);
    
    const booksRaw = livrosSheet.getDataRange().getValues();
    const loansRaw = emprestimosSheet.getDataRange().getValues();
    
    const role = getUserRole(email);
    const isAdmin = role === "master_admin" || role === "admin" || email.toLowerCase().trim() === "andreiaandy07@gmail.com" || email.toLowerCase().trim() === "albertofit7@gmail.com";
    
    // Processa Livros
    let books = [];
    for (let i = 1; i < booksRaw.length; i++) {
      const activeVal = booksRaw[i][8];
      const isAtivo = activeVal === true || activeVal === "TRUE" || activeVal === "true" || activeVal === "";
      if (!isAtivo) continue;
      
      books.push({
        id: booksRaw[i][0].toString(),
        titulo: booksRaw[i][1].toString(),
        autor: booksRaw[i][2].toString(),
        sinopse: booksRaw[i][3].toString(),
        capaUrl: booksRaw[i][4].toString(),
        localizacao: booksRaw[i][5].toString(),
        qtdTotal: parseInt(booksRaw[i][6]) || 0,
        qtdDisponivel: parseInt(booksRaw[i][7]) || 0,
        categoria: booksRaw[i][9] ? booksRaw[i][9].toString() : "Geral"
      });
    }
    
    // Processa Empréstimos
    let loans = [];
    const searchEmail = email.toLowerCase().trim();
    for (let i = 1; i < loansRaw.length; i++) {
      const loanEmail = loansRaw[i][3].toString().toLowerCase().trim();
      
      if (!isAdmin && loanEmail !== searchEmail) continue;
      
      const status = loansRaw[i][9].toString();
      let displayStatus = status;
      
      if (status === "Ativo" && loansRaw[i][7]) {
        const expectedDate = new Date(loansRaw[i][7]);
        if (new Date() > expectedDate) {
          displayStatus = "Atrasado";
        }
      }
      
      loans.push({
        id: loansRaw[i][0].toString(),
        livroId: loansRaw[i][1].toString(),
        tituloLivro: loansRaw[i][2].toString(),
        email: loansRaw[i][3].toString(),
        nome: loansRaw[i][4].toString(),
        dataSolicitacao: loansRaw[i][5] ? new Date(loansRaw[i][5]).toISOString() : null,
        dataRetirada: loansRaw[i][6] ? new Date(loansRaw[i][6]).toISOString() : null,
        dataDevolucaoPrevista: loansRaw[i][7] ? new Date(loansRaw[i][7]).toISOString() : null,
        dataDevolucaoReal: loansRaw[i][8] ? new Date(loansRaw[i][8]).toISOString() : null,
        status: displayStatus
      });
    }
    
    return createJsonResponse({
      status: "success",
      books: books,
      loans: loans,
      isAdmin: isAdmin
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao buscar dados da biblioteca: " + err.toString() });
  }
}

function handleSaveBook(bookData) {
  if (!bookData || !bookData.titulo || !bookData.adminEmail) {
    return createJsonResponse({ status: "error", message: "Dados do livro incompletos." });
  }
  
  const role = getUserRole(bookData.adminEmail);
  const emailClean = bookData.adminEmail.toLowerCase().trim();
  const isAdmin = role === "master_admin" || role === "admin" || emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";
  if (!isAdmin) {
    return createJsonResponse({ status: "error", message: "Apenas administradores podem gerenciar livros." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet } = checkAndInitLibrarySheets(ss);
    const booksRaw = livrosSheet.getDataRange().getValues();
    
    const id = bookData.id || "LIV-" + new Date().getTime();
    const titulo = bookData.titulo;
    const autor = bookData.autor || "";
    const sinopse = bookData.sinopse || "";
    const capaUrl = bookData.capaUrl || "";
    const localizacao = bookData.localizacao || "";
    const qtdTotal = parseInt(bookData.qtdTotal) || 1;
    const categoria = bookData.categoria || "Geral";
    
    let rowIndex = -1;
    let oldQtdDisponivel = qtdTotal;
    let oldQtdTotal = qtdTotal;
    
    if (bookData.id) {
      for (let i = 1; i < booksRaw.length; i++) {
        if (booksRaw[i][0].toString() === id) {
          rowIndex = i + 1;
          oldQtdTotal = parseInt(booksRaw[i][6]) || 0;
          oldQtdDisponivel = parseInt(booksRaw[i][7]) || 0;
          break;
        }
      }
    }
    
    const diff = qtdTotal - oldQtdTotal;
    let qtdDisponivel = oldQtdDisponivel + diff;
    if (qtdDisponivel < 0) qtdDisponivel = 0;
    
    if (rowIndex !== -1) {
      livrosSheet.getRange(rowIndex, 2).setValue(titulo);
      livrosSheet.getRange(rowIndex, 3).setValue(autor);
      livrosSheet.getRange(rowIndex, 4).setValue(sinopse);
      livrosSheet.getRange(rowIndex, 5).setValue(capaUrl);
      livrosSheet.getRange(rowIndex, 6).setValue(localizacao);
      livrosSheet.getRange(rowIndex, 7).setValue(qtdTotal);
      livrosSheet.getRange(rowIndex, 8).setValue(qtdDisponivel);
      livrosSheet.getRange(rowIndex, 9).setValue(true);
      livrosSheet.getRange(rowIndex, 10).setValue(categoria);
    } else {
      livrosSheet.appendRow([id, titulo, autor, sinopse, capaUrl, localizacao, qtdTotal, qtdTotal, true, categoria]);
    }
    
    return createJsonResponse({ status: "success", message: "Livro salvo com sucesso!", id: id });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao salvar livro: " + err.toString() });
  }
}

function handleDeleteBook(bookData) {
  if (!bookData || !bookData.id || !bookData.adminEmail) {
    return createJsonResponse({ status: "error", message: "Dados incompletos." });
  }
  
  const role = getUserRole(bookData.adminEmail);
  const emailClean = bookData.adminEmail.toLowerCase().trim();
  const isAdmin = role === "master_admin" || role === "admin" || emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";
  if (!isAdmin) {
    return createJsonResponse({ status: "error", message: "Apenas administradores podem gerenciar livros." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet } = checkAndInitLibrarySheets(ss);
    const booksRaw = livrosSheet.getDataRange().getValues();
    
    for (let i = 1; i < booksRaw.length; i++) {
      if (booksRaw[i][0].toString() === bookData.id) {
        livrosSheet.getRange(i + 1, 9).setValue(false);
        return createJsonResponse({ status: "success", message: "Livro excluído com sucesso!" });
      }
    }
    
    return createJsonResponse({ status: "error", message: "Livro não encontrado." });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao excluir livro: " + err.toString() });
  }
}

function handleRequestBookLoan(loanData) {
  if (!loanData || !loanData.livroId || !loanData.email || !loanData.nome) {
    return createJsonResponse({ status: "error", message: "Dados do empréstimo incompletos." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet, emprestimosSheet } = checkAndInitLibrarySheets(ss);
    
    const booksRaw = livrosSheet.getDataRange().getValues();
    let bookIndex = -1;
    let bookTitle = "";
    let qtdDisponivel = 0;
    
    for (let i = 1; i < booksRaw.length; i++) {
      if (booksRaw[i][0].toString() === loanData.livroId) {
        const activeVal = booksRaw[i][8];
        const isAtivo = activeVal === true || activeVal === "TRUE" || activeVal === "true" || activeVal === "";
        if (!isAtivo) break;
        
        bookIndex = i + 1;
        bookTitle = booksRaw[i][1].toString();
        qtdDisponivel = parseInt(booksRaw[i][7]) || 0;
        break;
      }
    }
    
    if (bookIndex === -1) {
      return createJsonResponse({ status: "error", message: "Livro não disponível para empréstimo." });
    }
    
    if (qtdDisponivel <= 0) {
      return createJsonResponse({ status: "error", message: "Não há exemplares disponíveis no momento." });
    }
    
    const loansRaw = emprestimosSheet.getDataRange().getValues();
    const searchEmail = loanData.email.toLowerCase().trim();
    for (let i = 1; i < loansRaw.length; i++) {
      const lEmail = loansRaw[i][3].toString().toLowerCase().trim();
      const lLivroId = loansRaw[i][1].toString();
      const lStatus = loansRaw[i][9].toString();
      
      if (lEmail === searchEmail && lLivroId === loanData.livroId && (lStatus === "Solicitado" || lStatus === "Ativo")) {
        return createJsonResponse({ status: "error", message: "Você já possui uma solicitação ou empréstimo ativo deste livro." });
      }
    }
    
    livrosSheet.getRange(bookIndex, 8).setValue(qtdDisponivel - 1);
    
    const loanId = "EMP-" + new Date().getTime();
    const now = new Date();
    
    emprestimosSheet.appendRow([
      loanId,
      loanData.livroId,
      bookTitle,
      loanData.email,
      loanData.nome,
      now,
      "",
      "",
      "",
      "Solicitado"
    ]);
    
    return createJsonResponse({ status: "success", message: "Solicitação enviada! Retire o livro no terreiro." });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao solicitar empréstimo: " + err.toString() });
  }
}

function handleCancelBookLoanRequest(loanData) {
  if (!loanData || !loanData.loanId) {
    return createJsonResponse({ status: "error", message: "ID do empréstimo ausente." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet, emprestimosSheet } = checkAndInitLibrarySheets(ss);
    
    const loansRaw = emprestimosSheet.getDataRange().getValues();
    let loanRowIndex = -1;
    let livroId = "";
    let status = "";
    
    for (let i = 1; i < loansRaw.length; i++) {
      if (loansRaw[i][0].toString() === loanData.loanId) {
        loanRowIndex = i + 1;
        livroId = loansRaw[i][1].toString();
        status = loansRaw[i][9].toString();
        break;
      }
    }
    
    if (loanRowIndex === -1) {
      return createJsonResponse({ status: "error", message: "Solicitação não encontrada." });
    }
    
    if (status !== "Solicitado") {
      return createJsonResponse({ status: "error", message: "Apenas solicitações pendentes podem ser canceladas." });
    }
    
    emprestimosSheet.getRange(loanRowIndex, 10).setValue("Cancelado");
    
    const booksRaw = livrosSheet.getDataRange().getValues();
    for (let i = 1; i < booksRaw.length; i++) {
      if (booksRaw[i][0].toString() === livroId) {
        const currentDisp = parseInt(booksRaw[i][7]) || 0;
        livrosSheet.getRange(i + 1, 8).setValue(currentDisp + 1);
        break;
      }
    }
    
    return createJsonResponse({ status: "success", message: "Solicitação cancelada com sucesso!" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao cancelar solicitação: " + err.toString() });
  }
}

function handleConfirmBookPickup(loanData) {
  if (!loanData || !loanData.loanId || !loanData.adminEmail) {
    return createJsonResponse({ status: "error", message: "Dados incompletos." });
  }
  
  const role = getUserRole(loanData.adminEmail);
  const emailClean = loanData.adminEmail.toLowerCase().trim();
  const isAdmin = role === "master_admin" || role === "admin" || emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";
  if (!isAdmin) {
    return createJsonResponse({ status: "error", message: "Apenas administradores podem confirmar retiradas." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { emprestimosSheet } = checkAndInitLibrarySheets(ss);
    
    const loansRaw = emprestimosSheet.getDataRange().getValues();
    let loanRowIndex = -1;
    let status = "";
    
    for (let i = 1; i < loansRaw.length; i++) {
      if (loansRaw[i][0].toString() === loanData.loanId) {
        loanRowIndex = i + 1;
        status = loansRaw[i][9].toString();
        break;
      }
    }
    
    if (loanRowIndex === -1) {
      return createJsonResponse({ status: "error", message: "Empréstimo não encontrado." });
    }
    
    if (status !== "Solicitado") {
      return createJsonResponse({ status: "error", message: "Este empréstimo não está com retirada pendente." });
    }
    
    const now = new Date();
    const expected = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    emprestimosSheet.getRange(loanRowIndex, 7).setValue(now);
    emprestimosSheet.getRange(loanRowIndex, 8).setValue(expected);
    emprestimosSheet.getRange(loanRowIndex, 10).setValue("Ativo");
    
    return createJsonResponse({ status: "success", message: "Retirada confirmada! Empréstimo ativo." });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao confirmar retirada: " + err.toString() });
  }
}

function handleConfirmBookReturn(loanData) {
  if (!loanData || !loanData.loanId || !loanData.adminEmail) {
    return createJsonResponse({ status: "error", message: "Dados incompletos." });
  }
  
  const role = getUserRole(loanData.adminEmail);
  const emailClean = loanData.adminEmail.toLowerCase().trim();
  const isAdmin = role === "master_admin" || role === "admin" || emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";
  if (!isAdmin) {
    return createJsonResponse({ status: "error", message: "Apenas administradores podem confirmar devoluções." });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet, emprestimosSheet } = checkAndInitLibrarySheets(ss);
    
    const loansRaw = emprestimosSheet.getDataRange().getValues();
    let loanRowIndex = -1;
    let livroId = "";
    let status = "";
    
    for (let i = 1; i < loansRaw.length; i++) {
      if (loansRaw[i][0].toString() === loanData.loanId) {
        loanRowIndex = i + 1;
        livroId = loansRaw[i][1].toString();
        status = loansRaw[i][9].toString();
        break;
      }
    }
    
    if (loanRowIndex === -1) {
      return createJsonResponse({ status: "error", message: "Empréstimo não encontrado." });
    }
    
    if (status !== "Ativo" && status !== "Solicitado") {
      return createJsonResponse({ status: "error", message: "Este empréstimo não está ativo." });
    }
    
    const now = new Date();
    
    emprestimosSheet.getRange(loanRowIndex, 9).setValue(now);
    emprestimosSheet.getRange(loanRowIndex, 10).setValue("Devolvido");
    
    const booksRaw = livrosSheet.getDataRange().getValues();
    for (let i = 1; i < booksRaw.length; i++) {
      if (booksRaw[i][0].toString() === livroId) {
        const currentDisp = parseInt(booksRaw[i][7]) || 0;
        livrosSheet.getRange(i + 1, 8).setValue(currentDisp + 1);
        break;
      }
    }
    
    return createJsonResponse({ status: "success", message: "Devolução registrada com sucesso!" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Erro ao confirmar devolução: " + err.toString() });
  }
}

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("TUIG - Administração")
      .addItem("Consolidar Livros do Acervo", "consolidateBooks")
      .addItem("Buscar Capas e Sinopses Automaticamente", "enrichBookDetails")
      .addToUi();
  } catch (e) {
    Logger.log("Não foi possível criar o menu da planilha. Se você está executando do editor, isso é normal: " + e.toString());
  }
}

function showAlert(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log("ALERTA: " + msg);
  }
}

function consolidateBooks() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet } = checkAndInitLibrarySheets(ss);
    
    const booksRaw = livrosSheet.getDataRange().getValues();
    const existingBooks = new Set();
    for (let i = 1; i < booksRaw.length; i++) {
      const title = booksRaw[i][1].toString().toLowerCase().trim();
      const author = booksRaw[i][2].toString().toLowerCase().trim();
      existingBooks.add(`${title}||${author}`);
    }
    
    const sheets = ss.getSheets();
    let importedCount = 0;
    
    for (const sheet of sheets) {
      const name = sheet.getName();
      // Pula as abas que nós criamos
      if (name === NOME_ABA_LIVROS || name === NOME_ABA_EMPRESTIMOS) continue;
      
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue; // Pula abas vazias ou com apenas cabeçalho
      
      for (let i = 1; i < data.length; i++) {
        const title = data[i][0] ? data[i][0].toString().trim() : "";
        const author = data[i][1] ? data[i][1].toString().trim() : "";
        
        if (!title) continue;
        
        const key = `${title.toLowerCase()}||${author.toLowerCase()}`;
        if (!existingBooks.has(key)) {
          // Gera um ID único simples
          const id = "LIV-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
          // Colunas: ID, Título, Autor, Sinopse, CapaURL, Localização, QtdTotal, QtdDisponivel, Ativo, Categoria
          livrosSheet.appendRow([id, title, author, "", "", "Acervo", 1, 1, true, name]);
          existingBooks.add(key);
          importedCount++;
        }
      }
    }
    
    showAlert(`Consolidação Concluída!\n\n${importedCount} novos livros foram importados e organizados por categorias na aba '${NOME_ABA_LIVROS}'.`);
  } catch (err) {
    showAlert("Erro ao consolidar acervo: " + err.toString());
  }
}

function enrichBookDetails() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_BIBLIOTECA_ID);
    const { livrosSheet } = checkAndInitLibrarySheets(ss);
    
    const data = livrosSheet.getDataRange().getValues();
    if (data.length <= 1) {
      showAlert("Nenhum livro encontrado para enriquecer.");
      return;
    }
    
    let enrichedCount = 0;
    let checkedCount = 0;
    
    // Processamos no máximo 50 livros por rodada para evitar timeouts do Google Apps Script
    const maxBatch = 50;
    
    for (let i = 1; i < data.length; i++) {
      if (enrichedCount >= maxBatch) break;
      
      const title = data[i][1] ? data[i][1].toString().trim() : "";
      const author = data[i][2] ? data[i][2].toString().trim() : "";
      const currentSynopsis = data[i][3] ? data[i][3].toString().trim() : "";
      const currentCover = data[i][4] ? data[i][4].toString().trim() : "";
      const activeVal = data[i][8];
      const isAtivo = activeVal === true || activeVal === "TRUE" || activeVal === "true" || activeVal === "";
      
      // Só busca se o livro estiver ativo e não tiver sinopse OU não tiver capa
      if (isAtivo && (!currentSynopsis || !currentCover)) {
        checkedCount++;
        
        let queryStr = title;
        if (author && author.toLowerCase() !== "não informado" && author.toLowerCase() !== "não cadastrada") {
          queryStr += " " + author;
        }
        
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(queryStr)}&limit=1`;
        
        try {
          const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
          if (response.getResponseCode() === 200) {
            const json = JSON.parse(response.getContentText());
            if (json.docs && json.docs.length > 0) {
              const doc = json.docs[0];
              
              let newSynopsis = currentSynopsis;
              let newCover = currentCover;
              
              // 1. Busca Capa
              if (!currentCover) {
                if (doc.cover_i) {
                  newCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
                } else if (doc.cover_edition_key) {
                  newCover = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
                }
              }
              
              // 2. Busca Sinopse (Faz uma segunda requisição detalhada do Work se necessário)
              if (!currentSynopsis && doc.key) {
                const workUrl = `https://openlibrary.org${doc.key}.json`;
                const workRes = UrlFetchApp.fetch(workUrl, { muteHttpExceptions: true });
                if (workRes.getResponseCode() === 200) {
                  const workJson = JSON.parse(workRes.getContentText());
                  if (workJson.description) {
                    if (typeof workJson.description === 'object' && workJson.description.value) {
                      newSynopsis = workJson.description.value;
                    } else if (typeof workJson.description === 'string') {
                      newSynopsis = workJson.description;
                    }
                  }
                }
              }
              
              // Grava na planilha se mudou alguma coisa
              if (newSynopsis !== currentSynopsis || newCover !== currentCover) {
                const rowIndex = i + 1;
                if (newSynopsis !== currentSynopsis) {
                  livrosSheet.getRange(rowIndex, 4).setValue(newSynopsis);
                }
                if (newCover !== currentCover) {
                  livrosSheet.getRange(rowIndex, 5).setValue(newCover);
                }
                enrichedCount++;
              }
            }
          }
          Utilities.sleep(500); // Respeitar limites do Open Library
        } catch (e) {
          Logger.log(`Erro ao buscar detalhes no Open Library para "${title}": ` + e.toString());
        }
      }
    }
    
    showAlert(
      `Varredura Concluída!\n\n` +
      `- Livros analisados nesta rodada: ${checkedCount}\n` +
      `- Livros enriquecidos com sucesso (capa/sinopse adicionados): ${enrichedCount}\n\n` +
      `Se ainda houver livros sem dados, basta rodar o menu novamente.`
    );
  } catch (err) {
    showAlert("Erro ao enriquecer acervo: " + err.toString());
  }
}

