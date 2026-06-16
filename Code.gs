/**
 * Sistema de Gestão de Rituais - Google Apps Script (BACKEND API JSON)
 * Novo Backend: Retorna apenas JSON para ser consumido pelo App no Vercel/Hostinger
 */

const SPREADSHEET_ID = "1N8gsG2A99KI1f-DuoPYffTrvIqHzjDQb-5_voIu4QWc";
const NOME_ABA_USUARIOS = "Usuários";
const NOME_ABA_RITUAIS = "Rituais";
const NOME_ABA_PRESENCAS = "Presenças";
const NOME_ABA_AGENDA = "Agenda";
const NOME_ABA_JUSTIFICATIVAS = "Justificativas";

// Configurações do Terreiro
const TERREIRO_LAT = -23.48319550467122;
const TERREIRO_LON = -46.58630431299817;
const RAIO_TOLERANCIA_METROS = 25;

// Cabeçalhos CORS para permitir acesso de qualquer domínio (PWA na Hostinger)
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

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
           const pDate = new Date(presencesData[i][0]);
           let adjustedPDate = new Date(pDate.getTime());
           if (adjustedPDate.getHours() < 2) {
               adjustedPDate.setHours(adjustedPDate.getHours() - 3);
           }
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
      const evtDate = new Date(agendaData[i][0]);
      if (isNaN(evtDate.getTime())) continue;
      const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
      const evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : "";
      
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
  
  const INTERVALO_PADRAO_DIAS = 21; 
  let tempoParaProximo = "Disponível agora";
  if (userRituals.length > 0) {
    const ultimoRitual = userRituals[0].timestamp;
    const proximaData = ultimoRitual + (INTERVALO_PADRAO_DIAS * 24 * 60 * 60 * 1000);
    const diff = proximaData - hoje;
    if (diff > 0) tempoParaProximo = "Em " + Math.ceil(diff / (1000 * 60 * 60 * 24)) + " dias";
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
        const evtDate = new Date(agendaData[i][0]);
        const evtNome = agendaData[i][1];
        const evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : "ambos";
        
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
            const pDate = new Date(p[0]);
            
            // Ajuste para madrugadas: Se marcou presença entre 00:00 e 01:59 da manhã (ex: de Sábado),
            // a presença pertence ao evento da noite anterior (ex: Sexta-feira).
            let adjustedPDate = new Date(pDate.getTime());
            if (adjustedPDate.getHours() < 2) {
                adjustedPDate.setHours(adjustedPDate.getHours() - 3); 
            }
            
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
    const hojeAjustado = new Date(hojeVal.getTime());
    if (hojeAjustado.getHours() < 2) {
        hojeAjustado.setHours(hojeAjustado.getHours() - 3);
    }
    const hojeAjustadoString = hojeAjustado.toLocaleDateString("pt-BR");
    
    for (let i = 1; i < presencesData.length; i++) {
        const pDate = new Date(presencesData[i][0]);
        
        // Ajusta a data de presença se foi marcada na madrugada
        let adjustedPDate = new Date(pDate.getTime());
        if (adjustedPDate.getHours() < 2) {
            adjustedPDate.setHours(adjustedPDate.getHours() - 3);
        }
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
    presenceToday: presenceToday,
    canMarkPresence: canMarkPresence,
    blockReason: blockReason
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
  for(let i=1; i < userData.length; i++) {
    if(userData[i][0].toString().toLowerCase().trim() === studentEmail.toLowerCase().trim()) {
      studentName = userData[i][1];
      break;
    }
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
      const evtDate = new Date(agendaData[i][0]);
      const evtTime = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate()).getTime();
      
      if (evtTime <= hojeTime) {
        let evtTurma = agendaData[i][2] ? agendaData[i][2].toString().toLowerCase().trim() : "ambos";
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
      const pDate = new Date(presencesData[i][0]);
      let adjustedPDate = new Date(pDate.getTime());
      if (adjustedPDate.getHours() < 2) {
          adjustedPDate.setHours(adjustedPDate.getHours() - 3); 
      }
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
