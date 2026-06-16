import { API_URL } from './config.js';
import { getBadgeClass, openModalById, closeModalById, renderGenericHistory, normalizeText } from './utils.js';
import { renderStudentDashboard } from './student.js';

export async function renderAdminDashboard(email) {
    const role = localStorage.getItem('tuig_role') || 'admin';
    const isMaster = role === 'master_admin';

    const app = document.getElementById('app');

    app.innerHTML = `
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 48px; flex-wrap: wrap; gap: 20px;">
            <div style="text-align: left; flex: 1; min-width: 200px;">
                <h1 style="margin: 0; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.04em;">Administração</h1>
                <p style="margin: 6px 0 0 0; font-size: 0.9rem; color: var(--text-muted); font-weight: 400;">Logado como: <span style="color: var(--accent); font-weight: 500;">${email}</span></p>
            </div>
            <button id="btn-logout" style="padding: 10px 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(239, 68, 68, 0.08); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; cursor: pointer; transition: all 0.3s;">
                Sair
            </button>
        </header>

        <nav class="tab-container" style="display: flex; gap: 8px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 18px; margin-bottom: 40px; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; justify-content: center;">
            ${isMaster ? `<button id="btn-tab-dashboard" class="tab-button" data-tab="dashboard" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Painel Gerencial</button>` : ''}
            <button id="btn-tab-admin" class="tab-button active" data-tab="admin" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Gestão de Alunos</button>
            <button id="btn-tab-student" class="tab-button" data-tab="student" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Minha Ficha</button>
        </nav>

        <!-- Seção Administrativa -->
        <section id="section-admin">
            <div class="presence-card" style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px;">
                <h3 style="margin-bottom: 15px; font-weight: 500;">Presença no Terreiro</h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <button id="btn-self-presence" class="btn-presence">
                        <span>📍</span> Minha Presença
                    </button>
                    <button id="btn-toggle-brother" class="btn-presence" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                        <span>👥</span> Registrar Irmão
                    </button>
                    ${isMaster ? `
                    <button id="btn-bulk-presence" class="btn-presence" style="background: rgba(99, 102, 241, 0.1); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3);">
                        <span>📋</span> Chamada em Massa
                    </button>` : ''}
                </div>

                <div id="brother-presence-form" class="hidden presence-input-group" style="margin-top: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">E-mail ou nome do Irmão:</label>
                    <input type="text" id="brother-identifier" placeholder="Email@teste.com ou teste email">
                    <button id="btn-brother-presence" class="btn-presence" style="margin-top: 15px; padding: 12px; width: 100%;">
                        Confirmar Presença do Irmão
                    </button>
                </div>

                <div id="gps-status" style="margin-top:10px; text-align:center; font-size:0.9rem; color:var(--text-muted);">
                    <div id="gps-dot" class="dot-pulse hidden" style="display:inline-block; width:8px; height:8px; background:#4f46e5; border-radius:50%; margin-right:5px;"></div>
                    <span id="gps-msg">Localização obrigatória para registro</span>
                </div>
            </div>

            <!-- Tabela de Usuários -->
            <div class="card animate-fade-in" style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <h3 style="margin:0;">Médiuns Cadastrados</h3>
                        <div style="position: relative; flex: 1; min-width: 200px;">
                            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%);">🔍</span>
                            <input type="text" id="search-input" placeholder="Buscar por nome..." style="padding: 10px 10px 10px 35px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; width: 100%; margin-bottom: 0; box-sizing: border-box;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
                        <button class="turma-filter-btn" data-turma="sexta" style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: white; cursor: pointer; font-weight: 600;">Sexta</button>
                        <button class="turma-filter-btn" data-turma="sabado" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--text-muted); cursor: pointer; font-weight: 600;">Sábado</button>
                    </div>
                </div>

                <div class="table-container" style="overflow-x: auto;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Cursos/Funções</th>
                                <th id="action-header">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                            <tr id="table-skeleton-row">
                                <td colspan="4">
                                    <div class="skeleton skeleton-text" style="width: 100%; height: 40px; margin-bottom: 10px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; height: 40px; margin-bottom: 10px;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- Seção Minha Ficha -->
        <section id="section-student" class="hidden">
             <!-- Placeholder para injeção do renderStudentDashboard mas na mesma tela -->
             <div id="student-container"></div>
        </section>

        <!-- Seção Dashboard Gerencial -->
        <section id="section-dashboard" class="hidden" style="margin-bottom: 40px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em;">Resumo de Frequência</h2>
                <button id="btn-export-pdf" style="background-color: var(--primary); color: white; border: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: 600; padding: 10px 18px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: var(--glow-shadow);">
                    <span>📄</span> Exportar Relatório PDF
                </button>
            </div>

            <!-- KPIs -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 24px; margin-bottom: 40px;">
                <div class="stat-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); text-align: left; box-shadow: var(--premium-shadow); position: relative; overflow: hidden;">
                    <div style="position: absolute; top:0; left:0; width:4px; height:100%; background: var(--accent);"></div>
                    <h4 style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Médiuns Ativos</h4>
                    <div id="kpi-total" style="font-size: 2.5rem; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.04em;">...</div>
                </div>
                <div class="stat-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); text-align: left; box-shadow: var(--premium-shadow); position: relative; overflow: hidden;">
                    <div style="position: absolute; top:0; left:0; width:4px; height:100%; background: var(--success);"></div>
                    <h4 style="margin: 0 0 12px 0; color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Assiduidade Média</h4>
                    <div id="kpi-assiduidade" style="font-size: 2.5rem; font-weight: 800; color: var(--success); line-height: 1; letter-spacing: -0.04em;">...</div>
                    <div id="kpi-texto" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 10px; font-weight: 400;">Aguardando dados...</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 32px; margin-bottom: 40px;">
                <div class="chart-container-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow);">
                    <h3 style="margin-top: 0; font-weight: 700; font-size: 1.15rem; margin-bottom: 24px; color: #fff; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">📈</span> Evolução de Presença (%)
                    </h3>
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="chartEvolucao"></canvas>
                    </div>
                </div>

                <div class="chart-container-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow);">
                    <h3 style="margin-top: 0; font-weight: 700; font-size: 1.15rem; margin-bottom: 24px; color: #fff; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">📊</span> Assiduidade por Turma
                    </h3>
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="chartTurmas"></canvas>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 32px;">
                <div class="chart-container-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow);">
                    <h3 style="margin-top: 0; font-weight: 700; font-size: 1.15rem; margin-bottom: 24px; color: var(--success); letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span>🌟</span> Top 5 Assíduos
                    </h3>
                    <div id="ranking-assiduos" style="display: flex; flex-direction: column; gap: 14px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Processando rankings...</span>
                    </div>
                </div>

                <div class="chart-container-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow);">
                    <h3 style="margin-top: 0; font-weight: 700; font-size: 1.15rem; margin-bottom: 24px; color: #f59e0b; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span>⚠️</span> Top 5 Ausentes
                    </h3>
                    <div id="ranking-ausentes" style="display: flex; flex-direction: column; gap: 14px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Processando rankings...</span>
                    </div>
                </div>

                <div class="chart-container-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow);">
                    <h3 style="margin-top: 0; font-weight: 700; font-size: 1.15rem; margin-bottom: 24px; color: #ef4444; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span>🚨</span> Alerta: +3 Faltas
                    </h3>
                    <div id="ranking-mais-faltas" style="display: flex; flex-direction: column; gap: 14px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Processando lista...</span>
                    </div>
                </div>
            </div>
        </section>
    `;

    // Initialize globals
    window.allUsers = [];
    window.currentUserEmail = email;
    window.dashboardCarregado = false;
    window.chartEvolucaoInstance = null;
    window.chartTurmasInstance = null;

    // Modais e Container
    let modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) {
        modalsContainer = document.createElement('div');
        modalsContainer.id = 'modals-container';
        document.body.appendChild(modalsContainer);
    }

    if (!document.getElementById('user-details-modal')) {
        modalsContainer.innerHTML += `
            <div id="user-details-modal" class="modal">
                <div class="modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                        <h2 id="modal-user-name" style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Detalhes do Médium</h2>
                        <span id="close-user-details" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>
                    <div id="modal-body">
                        <div id="modal-user-rituals">Carregando informações...</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (!document.getElementById('bulk-presence-modal')) {
        modalsContainer.innerHTML += `
            <div id="bulk-presence-modal" class="modal">
                <div class="modal-content" style="max-width: 600px; width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Chamada em Massa</h2>
                        <span id="close-bulk-presence" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div>
                            <label style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">Data</label>
                            <input type="date" id="bulk-date" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; outline:none;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">Turma</label>
                            <select id="bulk-turma" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; outline:none;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                                <option value="sexta">Sexta-feira</option>
                                <option value="sabado">Sábado</option>
                                <option value="geral">Gira Geral</option>
                            </select>
                        </div>
                    </div>
                    
                    <button id="btn-load-bulk" style="width:100%; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-weight:600; cursor:pointer; margin-bottom: 20px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        Carregar Lista
                    </button>
                    
                    <div id="bulk-list-container" style="max-height: 40vh; overflow-y: auto; margin-bottom: 20px; display:flex; flex-direction:column; gap:8px;">
                        <div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione a data/turma e clique em Carregar.</div>
                    </div>

                    <div id="bulk-feedback" style="text-align:center; margin-bottom: 15px; font-size:0.9rem;"></div>

                    <button id="btn-save-bulk" style="width:100%; padding:14px; background:var(--primary); border:none; border-radius:10px; color:#fff; font-weight:700; cursor:pointer; display:none; transition: all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        Salvar Presenças
                    </button>
                </div>
            </div>
        `;
    }

    // Bind UI Events
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('tuig_email');
        window.location.reload();
    });

    document.getElementById('btn-self-presence').addEventListener('click', () => markAdminPresence(email));

    document.getElementById('btn-toggle-brother').addEventListener('click', () => {
        const form = document.getElementById('brother-presence-form');
        form.classList.toggle('hidden');
    });

    document.getElementById('btn-brother-presence').addEventListener('click', () => {
        const brotherId = document.getElementById('brother-identifier').value.trim();
        if (!brotherId) {
            showPresenceError("Digite o e-mail ou nome do irmão.");
            return;
        }
        markAdminPresence(brotherId, email);
    });

    const btnBulk = document.getElementById('btn-bulk-presence');
    if (btnBulk) {
        btnBulk.addEventListener('click', () => {
            const today = new Date();
            // Pega data local YYYY-MM-DD
            const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            document.getElementById('bulk-date').value = todayStr;
            document.getElementById('bulk-list-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione a data/turma e clique em Carregar.</div>';
            document.getElementById('btn-save-bulk').style.display = 'none';
            document.getElementById('bulk-feedback').innerHTML = '';
            openModalById('bulk-presence-modal');
        });
    }

    const closeBulk = document.getElementById('close-bulk-presence');
    if (closeBulk) {
        closeBulk.addEventListener('click', () => closeModalById('bulk-presence-modal'));
    }

    const btnLoadBulk = document.getElementById('btn-load-bulk');
    if (btnLoadBulk) {
        btnLoadBulk.addEventListener('click', loadBulkPresenceList);
    }

    const btnSaveBulk = document.getElementById('btn-save-bulk');
    if (btnSaveBulk) {
        btnSaveBulk.addEventListener('click', () => saveBulkPresenceList(email));
    }

    document.getElementById('search-input').addEventListener('keyup', reRenderAdminTable);

    window.activeTurmaFilter = 'sexta';
    document.querySelectorAll('.turma-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.turma-filter-btn').forEach(b => {
                b.style.background = 'transparent';
                b.style.color = 'var(--text-muted)';
                b.style.borderColor = 'rgba(255,255,255,0.2)';
            });
            e.target.style.background = 'var(--accent)';
            e.target.style.color = 'white';
            e.target.style.borderColor = 'var(--accent)';
            window.activeTurmaFilter = e.target.getAttribute('data-turma');
            reRenderAdminTable();
        });
    });

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.getAttribute('data-tab')));
    });

    document.getElementById('btn-export-pdf').addEventListener('click', exportDashboardPDF);
    document.getElementById('close-user-details').addEventListener('click', () => closeModalById('user-details-modal'));

    // Fetch initial data
    fetchAdminData(email);
}

async function fetchAdminData(email) {
    try {
        const res = await fetch(`${API_URL}?action=getAdminData&email=${encodeURIComponent(email)}`, {
            redirect: 'follow',
            headers: { 'Accept': 'application/json' }
        });

        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error("getAdminData: Resposta não é JSON válido:", text.substring(0, 300));
            document.getElementById('users-table-body').innerHTML = `<tr><td colspan="4" style="color:#ef4444;text-align:center;">Servidor retornou resposta inválida. Tente recarregar.</td></tr>`;
            return;
        }

        if (json.status === "success") {
            const allAPIUsers = json.data;
            let currentUserRole = localStorage.getItem('tuig_role') || 'admin';
            if (json.role) {
                currentUserRole = json.role;
                localStorage.setItem('tuig_role', json.role);
            }

            // O backend já envia a lista filtrada corretamente baseada na coluna "Áreas de Gestão"
            window.allUsers = allAPIUsers;

            reRenderAdminTable();
        } else {
            document.getElementById('users-table-body').innerHTML = `<tr><td colspan="4" style="color:#ef4444;text-align:center;">${json.message}</td></tr>`;
        }
    } catch (e) {
        console.error("fetchAdminData erro:", e);
        document.getElementById('users-table-body').innerHTML = `<tr><td colspan="4" style="color:#ef4444;text-align:center;">Erro de conexão com o servidor.</td></tr>`;
    }
}

function renderAdminTable(users, role) {
    const tbody = document.getElementById('users-table-body');
    const thActions = document.getElementById('action-header');

    if (role !== 'master_admin') {
        if (thActions) thActions.style.display = 'none';
    }

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    let html = '';
    users.forEach((u, index) => {
        let badges = '';
        if (u.cursos) {
            u.cursos.forEach(c => {
                badges += `<span class="badge ${getBadgeClass(c)}" style="margin-right:4px;">${c}</span>`;
            });
        }

        let actionTd = '';
        if (role === 'master_admin') {
            actionTd = `<td data-label="Ações">
                <button class="btn-primary details-btn" data-email="${u.email}" data-nome="${u.nome}" style="padding:10px 16px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; background:rgba(99, 102, 241, 0.1); color:#a5b4fc; border:1px solid rgba(99, 102, 241, 0.2); width:100%;">
                    Ver Frequência
                </button>
            </td>`;
        }

        html += `
            <tr class="user-row">
                <td data-label="Nome">
                    <div style="font-weight:700; color:#fff; font-size:1.05rem; letter-spacing:-0.01em;">${u.nome}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                        Turma: <span style="color:var(--accent)">${u.turma}</span>
                    </div>
                </td>
                <td data-label="Email" style="color:var(--text-muted); font-size:0.85rem; word-break: break-word; overflow-wrap: anywhere; font-weight:400;">${u.email}</td>
                <td data-label="Cursos/Funções">
                    <div style="display:flex; flex-wrap:wrap; gap:6px; max-width: 100%;">${badges}</div>
                </td>
                ${actionTd}
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Bind dynamic buttons
    if (role === 'master_admin') {
        tbody.querySelectorAll('.details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openUserDetails(e.currentTarget.getAttribute('data-email'), e.currentTarget.getAttribute('data-nome'));
            });
        });
    }
}

function reRenderAdminTable() {
    const role = localStorage.getItem('tuig_role') || 'admin';
    const termo = document.getElementById('search-input').value.toLowerCase();
    
    // Filtra janela inteira na memória (Javascript) – muito mais leve para a renderização
    const filteredUsers = window.allUsers.filter(u => {
        const uTurmaNorm = normalizeText(u.turma);
        const filterNorm = normalizeText(window.activeTurmaFilter);
        
        const isRightTurma = uTurmaNorm.includes(filterNorm);
        
        // Match Search Input
        let matchesSearch = true;
        if (termo) {
             const stringToSearch = normalizeText(u.nome + " " + u.email + " " + (u.turma || "") + " " + (u.cursos ? u.cursos.join(" ") : ""));
             matchesSearch = stringToSearch.includes(normalizeText(termo));
        }
        return isRightTurma && matchesSearch;
    });

    renderAdminTable(filteredUsers, role);
}

async function openUserDetails(emailBusca, nome) {
    document.getElementById('modal-user-name').innerText = `Detalhes de ${nome}`;
    document.getElementById('modal-user-rituals').innerHTML = '<div class="loader active"></div>';

    openModalById('user-details-modal');

    try {
        const res = await fetch(`${API_URL}?action=getUserData&email=${encodeURIComponent(emailBusca)}`);
        const json = await res.json();

        let container = document.getElementById('modal-user-rituals');
        if (json.status === "success") {
            let html = '';
            const data = json.data;

            if (data.frequencyStats) {
                html += `
                <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 24px; border-radius: 20px; margin-bottom: 24px; position: relative; overflow: hidden;">
                    <div style="position: absolute; top:0; left:0; width:4px; height:100%; background: var(--success);"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--success); text-transform: uppercase; letter-spacing: 0.1em;">Assiduidade</span>
                        <span style="font-weight: 800; color: #fff; font-size: 1.2rem;">${data.frequencyStats.percentage}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin: 12px 0;">
                        <div style="width: ${data.frequencyStats.percentage}%; height: 100%; background: var(--success); border-radius: 3px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);"></div>
                    </div>
                    <p style="margin:0; font-size:0.9rem; color:var(--text-muted); font-weight: 400;">
                        Presente em <strong style="color:#fff">${data.frequencyStats.present}</strong> de <strong style="color:#fff">${data.frequencyStats.total}</strong> giras e rituais registrados.
                    </p>
                </div>`;
            }

            if (!data.rituals || data.rituals.length === 0) {
                html += '<p style="text-align:center; color:var(--text-muted); padding: 40px 0;">Sem rituais registrados no período.</p>';
            } else {
                html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
                data.rituals.forEach(r => {
                    const date = new Date(r.data).toLocaleDateString('pt-BR');
                    html += `
                        <div style="background: rgba(255,255,255,0.02); padding: 18px 24px; border-radius: 16px; border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; transition: all 0.3s ease;">
                            <div>
                                <div style="font-weight: 700; color: #fff; font-size: 1rem; margin-bottom: 4px;">${r.nome}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">
                                    ${r.intervalo}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: var(--accent); font-size: 0.85rem;">${date}</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:#ef4444">${json.message}</p>`;
        }
    } catch (e) {
        document.getElementById('modal-user-rituals').innerHTML = `<p style="color:#ef4444">Erro de conexão.</p>`;
    }
}

function switchTab(tab) {
    const adminSection = document.getElementById('section-admin');
    const studentSection = document.getElementById('section-student');
    const dashboardSection = document.getElementById('section-dashboard');

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-button[data-tab="${tab}"]`).classList.add('active');

    adminSection.classList.add('hidden');
    studentSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');

    if (tab === 'admin') {
        adminSection.classList.remove('hidden');
    } else if (tab === 'student') {
        studentSection.classList.remove('hidden');
        // Renderiza visao de estudante na aba
        const container = document.getElementById('student-container');
        if (container.innerHTML === "") {
            renderStudentDashboard(window.currentUserEmail, 'student-container');
        }
    } else if (tab === 'dashboard') {
        dashboardSection.classList.remove('hidden');
        if (!window.dashboardCarregado) {
            carregarDashboard();
        }
    }
}

async function carregarDashboard() {
    const btnEx = document.getElementById('btn-export-pdf');
    if (btnEx) btnEx.innerText = "Carregando...";

    try {
        const res = await fetch(`${API_URL}?action=getDashboardStats`);
        const json = await res.json();

        if (json.status === "success") {
            window.dashboardCarregado = true;
            if (btnEx) btnEx.innerText = "📄 Exportar PDF";
            renderizarDashboard(json.data);
        } else {
            if (btnEx) btnEx.innerText = "Erro!";
        }
    } catch (e) {
        if (btnEx) btnEx.innerText = "Erro de conexão!";
    }
}

function renderizarDashboard(stats) {
    document.getElementById('kpi-total').innerText = stats.kpis.totalMediuns;
    document.getElementById('kpi-assiduidade').innerText = stats.kpis.assiduidadeGeral + "%";
    document.getElementById('kpi-texto').innerText = stats.kpis.textoAssiduidade;

    const assiduosContainer = document.getElementById('ranking-assiduos');
    const ausentesContainer = document.getElementById('ranking-ausentes');

    if (stats.ranking && stats.ranking.assiduos.length > 0) {
        assiduosContainer.innerHTML = stats.ranking.assiduos.map((m, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.1); border-radius: 16px; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span style="font-size: 0.9rem; font-weight: 800; color: #22c55e; width: 24px;">${i + 1}º</span>
                    <div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${m.nome}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${m.turma}</div>
                    </div>
                </div>
                <div style="font-weight: 800; color: #22c55e; font-size: 1rem; letter-spacing: -0.02em;">
                    ${m.porcentagem}%
                </div>
            </div>
        `).join('');
    }

    if (stats.ranking && stats.ranking.ausentes.length > 0) {
        ausentesContainer.innerHTML = stats.ranking.ausentes.map((m, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.1); border-radius: 16px; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span style="font-size: 0.9rem; font-weight: 800; color: #f59e0b; width: 24px;">${i + 1}º</span>
                    <div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${m.nome}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${m.turma}</div>
                    </div>
                </div>
                <div style="font-weight: 800; color: #f59e0b; font-size: 1rem; letter-spacing: -0.02em;">
                    ${m.porcentagem}%
                </div>
            </div>
        `).join('');
    }

    const maisFaltasContainer = document.getElementById('ranking-mais-faltas');
    if (maisFaltasContainer) {
        if (stats.ranking && stats.ranking.maisDeTresFaltas && stats.ranking.maisDeTresFaltas.length > 0) {
            maisFaltasContainer.innerHTML = stats.ranking.maisDeTresFaltas.map((m) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 16px; transition: all 0.3s ease; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
                        <span style="font-size: 1.1rem; display: flex; align-items: center; justify-content: center; width: 24px; flex-shrink: 0;">❌</span>
                        <div style="min-width: 0;">
                            <div style="font-weight: 700; color: #fff; font-size: 0.95rem; word-break: break-word;">${m.nome}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${m.turma}</div>
                        </div>
                    </div>
                    <div style="font-weight: 800; color: #ef4444; font-size: 0.95rem; letter-spacing: -0.02em; text-align: right; white-space: nowrap; flex-shrink: 0;">
                        ${m.faltas} faltas
                    </div>
                </div>
            `).join('');
        } else {
            maisFaltasContainer.innerHTML = `
                <div style="text-align: center; color: var(--success); padding: 30px 0; font-weight: 600; font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="font-size: 1.5rem;">🎉</span>
                    <span>Nenhum médium com +3 faltas!</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">Todos estão com a presença em dia.</span>
                </div>
            `;
        }
    }

    if (window.Chart) {
        Chart.defaults.color = "#94a3b8";
        Chart.defaults.font.family = "'Inter', sans-serif";

        const ctxEvolucao = document.getElementById('chartEvolucao').getContext('2d');
        if (window.chartEvolucaoInstance) window.chartEvolucaoInstance.destroy();
        window.chartEvolucaoInstance = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: stats.lineChart.labels,
                datasets: [{
                    label: '% Presença Global',
                    data: stats.lineChart.data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: 'rgba(255,255,255,0.1)',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0, max: 100,
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#64748b', callback: function (v) { return v + '%' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        const ctxTurmas = document.getElementById('chartTurmas').getContext('2d');
        if (window.chartTurmasInstance) window.chartTurmasInstance.destroy();
        window.chartTurmasInstance = new Chart(ctxTurmas, {
            type: 'bar',
            data: {
                labels: ['Sexta-feira', 'Sábado'],
                datasets: [{
                    label: 'Assiduidade Média',
                    data: [stats.barChart.sexta, stats.barChart.sabado],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderRadius: 10,
                    borderSkipped: false,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100, ticks: { callback: function (v) { return v + '%' } } } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function exportDashboardPDF() {
    if (!window.html2pdf) {
        alert("O gerador de PDF está carregando, tente novamente em instantes.");
        return;
    }

    const section = document.getElementById('section-dashboard');
    const btn = document.getElementById('btn-export-pdf');

    btn.style.display = 'none';
    const oldBg = document.body.style.background;
    document.body.style.background = '#0f172a';

    var opt = {
        margin: 10,
        filename: 'Relatorio_Frequencias_TUIG.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(section).save().then(() => {
        btn.style.display = 'block';
        document.body.style.background = oldBg;
    });
}

function getDeviceId() {
    let id = localStorage.getItem('tuig_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('tuig_device_id', id);
    }
    return id;
}

function markAdminPresence(targetId, loggedInEmail = null) {
    const isBrother = loggedInEmail !== null;
    const btn = isBrother ? document.getElementById('btn-brother-presence') : document.getElementById('btn-self-presence');
    const msg = document.getElementById('gps-msg');
    const dot = document.getElementById('gps-dot');

    btn.disabled = true;
    msg.innerText = "Obtendo localização...";
    dot.classList.remove('hidden');

    if (!navigator.geolocation) {
        showPresenceError("GPS não suportado neste aparelho.", isBrother);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const data = {
                action: 'registerPresence',
                data: {
                    studentEmail: targetId,
                    registeredBy: loggedInEmail || targetId,
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    deviceId: getDeviceId()
                }
            };

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                const res = await response.json();

                if (res.status === "success") {
                    btn.innerHTML = "✅ Presença Confirmada!";
                    msg.innerText = res.message;
                    msg.style.color = res.withinRadius ? "#10b981" : "#ef4444";

                    if (!res.withinRadius) dot.style.background = "#ef4444";
                    else dot.style.background = "#10b981";
                    dot.classList.remove('hidden');
                } else {
                    showPresenceError(res.message, isBrother);
                }
            } catch (err) {
                showPresenceError("Erro de conexão com o servidor.", isBrother);
            }
        },
        (err) => {
            console.error("Erro GPS:", err);
            showPresenceError("Erro ao acessar GPS. Verifique as permissões.", isBrother);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function showPresenceError(errorText, isBrother) {
    const btn = isBrother ? document.getElementById('btn-brother-presence') : document.getElementById('btn-self-presence');
    const msg = document.getElementById('gps-msg');
    btn.disabled = false;
    msg.style.color = "#ef4444";
    msg.innerText = errorText;
}

async function loadBulkPresenceList() {
    const dateVal = document.getElementById('bulk-date').value;
    const turmaVal = document.getElementById('bulk-turma').value;
    const container = document.getElementById('bulk-list-container');
    const btnSave = document.getElementById('btn-save-bulk');
    const feedback = document.getElementById('bulk-feedback');
    const btnLoad = document.getElementById('btn-load-bulk');

    if (!dateVal) {
        feedback.innerHTML = '<span style="color:#ef4444">Selecione uma data válida.</span>';
        return;
    }

    feedback.innerHTML = '';
    btnLoad.innerText = 'Carregando...';
    btnLoad.disabled = true;
    container.innerHTML = '<div class="loader active"></div>';
    btnSave.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}?action=getBulkPresenceList&date=${dateVal}&turma=${turmaVal}`);
        const json = await res.json();

        if (json.status === "success") {
            const list = json.data;
            if (!list || list.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Nenhum médium encontrado para esta turma.</div>';
                btnLoad.innerText = 'Carregar Lista';
                btnLoad.disabled = false;
                return;
            }

            // Marcar quem já estava presente desde o inicio para impedir desmarcação
            list.forEach(u => u.originalPresent = u.isPresent);
            
            window.currentBulkList = list;
            renderBulkList(list);
            btnSave.style.display = 'block';
        } else {
            container.innerHTML = `<div style="color:#ef4444; text-align:center;">${json.message}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:#ef4444; text-align:center;">Erro de conexão com o servidor.</div>`;
    } finally {
        btnLoad.innerText = 'Carregar Lista';
        btnLoad.disabled = false;
    }
}

function renderBulkList(list) {
    const container = document.getElementById('bulk-list-container');
    let html = '';

    list.forEach((u, idx) => {
        const isPresent = u.isPresent;
        const color = isPresent ? '#10b981' : 'rgba(255,255,255,0.2)';
        const bg = isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)';
        const cursor = u.originalPresent ? 'default' : 'pointer';
        const opacity = u.originalPresent ? '0.7' : '1';
        
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; opacity: ${opacity};">
                <div>
                    <div style="font-weight:700; color:#fff; font-size:0.95rem;">${u.nome}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:500; text-transform:uppercase;">${u.turma}</div>
                </div>
                <div class="toggle-presence" data-idx="${idx}" style="cursor:${cursor}; display:flex; align-items:center; gap:8px; background:${bg}; padding:6px 12px; border-radius:20px; border:1px solid ${color}; transition:all 0.3s;">
                    <div style="width:12px; height:12px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${isPresent ? '#10b981' : 'transparent'};"></div>
                    <span style="font-size:0.8rem; font-weight:700; color:${isPresent ? '#10b981' : 'var(--text-muted)'}">${isPresent ? 'Presente' : 'Faltou'}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.toggle-presence').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-idx');
            const u = window.currentBulkList[idx];
            
            // Só permite alternar se não estava presente originalmente
            if (u.originalPresent) {
                // Feedback visual simples
                e.currentTarget.style.transform = 'scale(0.95)';
                setTimeout(() => e.currentTarget.style.transform = 'scale(1)', 150);
                return;
            }
            
            u.isPresent = !u.isPresent;
            renderBulkList(window.currentBulkList); // Re-renderiza para atualizar as cores
        });
    });
}

async function saveBulkPresenceList(adminEmail) {
    const list = window.currentBulkList;
    if (!list) return;

    // Filtra apenas os que mudaram de falso para verdadeiro (ou seja, os novos presentes marcados agora)
    const newPresences = list.filter(u => u.isPresent && !u.originalPresent);
    const feedback = document.getElementById('bulk-feedback');
    const btnSave = document.getElementById('btn-save-bulk');

    if (newPresences.length === 0) {
        feedback.innerHTML = '<span style="color:var(--text-muted)">Nenhuma nova presença para salvar.</span>';
        setTimeout(() => closeModalById('bulk-presence-modal'), 1500);
        return;
    }

    const dateVal = document.getElementById('bulk-date').value;

    btnSave.innerText = 'Salvando...';
    btnSave.disabled = true;
    feedback.innerHTML = '';

    const payload = {
        action: 'saveBulkPresence',
        data: {
            date: dateVal,
            adminEmail: adminEmail,
            presences: newPresences
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();

        if (res.status === "success") {
            feedback.innerHTML = `<span style="color:#10b981">✅ ${res.message}</span>`;
            // Atualiza o estado original para não enviar duplicado se clicar de novo
            newPresences.forEach(u => u.originalPresent = true);
            renderBulkList(window.currentBulkList);
            
            setTimeout(() => {
                closeModalById('bulk-presence-modal');
                btnSave.innerText = 'Salvar Presenças';
                btnSave.disabled = false;
            }, 2000);
        } else {
            feedback.innerHTML = `<span style="color:#ef4444">Erro: ${res.message}</span>`;
            btnSave.innerText = 'Salvar Presenças';
            btnSave.disabled = false;
        }
    } catch (err) {
        feedback.innerHTML = `<span style="color:#ef4444">Erro na conexão.</span>`;
        btnSave.innerText = 'Salvar Presenças';
        btnSave.disabled = false;
    }
}
