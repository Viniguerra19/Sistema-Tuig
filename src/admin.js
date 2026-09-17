import { getBadgeClass, openModalById, closeModalById, renderGenericHistory, normalizeText, apiFetch } from './utils.js';
import { renderStudentDashboard } from './student.js';
import { renderFollowupCenter } from './followup.js';
import { renderAdminReflections } from './reflection.js';
import { renderMembershipAdmin } from './membership.js';

export async function renderAdminDashboard(email) {
    const role = localStorage.getItem('tuig_role') || 'admin';
    const isMaster = role === 'master_admin';
    const emailClean = email.toLowerCase().trim();
    const isSpecialEmail = emailClean === 'andreiaandy07@gmail.com' || emailClean === 'albertofit7@gmail.com';
    const hasFullAdminAccess = (role === 'master_admin' || role === 'admin') && !isSpecialEmail;
    const hasReportAccess = isMaster || isSpecialEmail;

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
            ${hasFullAdminAccess ? `<button id="btn-tab-admin" class="tab-button active" data-tab="admin" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Gestão de Alunos</button>` : ''}
            ${isMaster ? `<button id="btn-tab-finance" class="tab-button" data-tab="finance" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Financeiro</button>` : ''}
            ${isMaster ? `<button id="btn-tab-library" class="tab-button" data-tab="library" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Biblioteca</button>` : ''}
            ${hasReportAccess ? `<button id="btn-tab-reports" class="tab-button ${!hasFullAdminAccess ? 'active' : ''}" data-tab="reports" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Relatórios de Rituais</button>` : ''}
            <button id="btn-tab-student" class="tab-button" data-tab="student" style="flex: 1 1 auto; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em;">Minha Ficha</button>
        </nav>

        <!-- Seção Administrativa -->
        <section id="section-followup" class="hidden"></section>
        <section id="section-admin" class="${!hasFullAdminAccess ? 'hidden' : ''}">
            <div class="presence-card" style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px;">
                <h3 style="margin-bottom: 15px; font-weight: 500;">Presença no Terreiro</h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <button id="btn-self-presence" class="btn-presence">
                        <span>📍</span> Minha Presença
                    </button>
                    ${isMaster ? `
                    <button id="btn-bulk-presence" class="btn-presence" style="background: rgba(99, 102, 241, 0.1); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3);">
                        <span>📋</span> Chamada em Massa
                    </button>` : ''}
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
                        <button class="turma-filter-btn" data-turma="domingo" style="padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--text-muted); cursor: pointer; font-weight: 600;">Domingo</button>
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

        <!-- Seção Financeiro (Mensalidades) -->
        <section id="section-finance" class="hidden">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em;">Controle Financeiro</h2>
            </div>

            <!-- Fila de Comprovantes Pendentes -->
            <div class="card animate-fade-in" style="background: rgba(255,255,255,0.02); padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-weight: 700; font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>⏳</span> Comprovantes Pendentes
                </h3>
                <div id="finance-pending-container" style="display: flex; flex-direction: column; gap: 12px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">Carregando pendências...</span>
                </div>
            </div>

            <!-- Relatório Geral de Mensalidades (Matriz) -->
            <div class="card animate-fade-in" style="background: rgba(255,255,255,0.02); padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <h3 style="margin:0; font-weight:700; font-size:1.15rem; color:#fff;">Status de Mensalidades (Ano Corrente)</h3>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                        <input type="text" id="finance-search-input" placeholder="Buscar aluno..." style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; margin-bottom: 0; width: 200px; font-size: 0.9rem;">
                        <select id="finance-turma-filter" style="padding: 8px 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; font-size: 0.9rem; outline: none;">
                            <option value="all">Todas as Turmas</option>
                            <option value="sexta">Sexta</option>
                            <option value="sabado">Sábado</option>
                            <option value="domingo">Domingo</option>
                        </select>
                    </div>
                </div>

                <div class="table-container" style="overflow-x: auto; max-width: 100%;">
                    <table class="admin-table" style="font-size: 0.85rem; width: 100%; border-spacing: 0 4px;">
                        <thead>
                            <tr>
                                <th style="padding: 10px 14px;">Aluno</th>
                                <th style="padding: 10px 14px; text-align: center;">Jan</th>
                                <th style="padding: 10px 14px; text-align: center;">Fev</th>
                                <th style="padding: 10px 14px; text-align: center;">Mar</th>
                                <th style="padding: 10px 14px; text-align: center;">Abr</th>
                                <th style="padding: 10px 14px; text-align: center;">Mai</th>
                                <th style="padding: 10px 14px; text-align: center;">Jun</th>
                                <th style="padding: 10px 14px; text-align: center;">Jul</th>
                                <th style="padding: 10px 14px; text-align: center;">Ago</th>
                                <th style="padding: 10px 14px; text-align: center;">Set</th>
                                <th style="padding: 10px 14px; text-align: center;">Out</th>
                                <th style="padding: 10px 14px; text-align: center;">Nov</th>
                                <th style="padding: 10px 14px; text-align: center;">Dez</th>
                            </tr>
                        </thead>
                        <tbody id="finance-table-body">
                            <!-- Preenchido dinamicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- Seção Relatórios de Rituais (Autorizados Only) -->
        ${hasReportAccess ? `
        <section id="section-reports" class="${!hasFullAdminAccess ? '' : 'hidden'}" style="margin-bottom: 40px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em;">Relatórios de Rituais</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="btn-export-reports-csv" style="background-color: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: 600; padding: 10px 18px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span>📥</span> Baixar CSV
                    </button>
                    <button id="btn-export-reports-pdf" style="background-color: var(--primary); color: white; border: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: 600; padding: 10px 18px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: var(--glow-shadow);">
                        <span>📄</span> Exportar PDF
                    </button>
                </div>
            </div>

            <!-- Card de Filtros -->
            <div class="card animate-fade-in" style="background: var(--glass-bg); padding: 24px; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 30px;">
                <h3 style="margin-top: 0; margin-bottom: 20px; font-weight: 700; font-size: 1.1rem; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>🔍</span> Configurar Filtros
                </h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Ritual de Referência</label>
                        <select id="report-selected-ritual" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 10px; outline: none; font-size: 0.95rem;">
                            <!-- Dinamicamente preenchido -->
                            <option value="">Carregando rituais...</option>
                        </select>
                    </div>

                    <div>
                        <label style="display: block; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Condição de Filtro</label>
                        <select id="report-filter-condition" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 10px; outline: none; font-size: 0.95rem;">
                            <option value="only">Possui apenas o ritual selecionado e nenhum outro</option>
                            <option value="has">Possui o ritual selecionado (mesmo que possua outros)</option>
                            <option value="not_has">Não possui o ritual selecionado</option>
                            <option value="custom">Filtro Personalizado (Múltiplos Rituais)</option>
                        </select>
                    </div>
                </div>

                <!-- Painel Customizado (Escondido por padrão) -->
                <div id="report-custom-filter-panel" class="hidden" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; font-size: 0.95rem; font-weight: 600; color: var(--accent);">Filtro por Múltiplos Rituais</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <div style="font-size: 0.8rem; color: var(--success); font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Deve Possuir (AND)</div>
                            <div id="custom-filter-must-have" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding: 10px; background: rgba(0,0,0,0.15); border-radius: 10px; border: 1px solid rgba(255,255,255,0.03);">
                                <!-- Checkboxes dinâmicos -->
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 0.8rem; color: #ef4444; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">NÃO Deve Possuir (NOR)</div>
                            <div id="custom-filter-must-not-have" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding: 10px; background: rgba(0,0,0,0.15); border-radius: 10px; border: 1px solid rgba(255,255,255,0.03);">
                                <!-- Checkboxes dinâmicos -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabela de Resultados -->
            <div class="card animate-fade-in" style="background: rgba(255,255,255,0.02); padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <div id="report-results-count" style="font-weight: 600; font-size: 1rem; color: var(--accent);">
                        Encontrando médiuns...
                    </div>
                    <div style="position: relative; width: 280px; max-width: 100%;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%);">🔍</span>
                        <input type="text" id="report-search-input" placeholder="Buscar nos resultados..." style="padding: 10px 10px 10px 35px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; width: 100%; margin-bottom: 0; box-sizing: border-box; font-size: 0.9rem;">
                    </div>
                </div>

                <div id="report-loader" class="loader active"></div>

                <div class="table-container" id="report-table-container" style="overflow-x: auto; display: none;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Nome / Turma</th>
                                <th>E-mail</th>
                                <th>Rituais Realizados</th>
                            </tr>
                        </thead>
                        <tbody id="report-table-body">
                            <!-- Injeção dinâmica -->
                        </tbody>
                    </table>
                </div>
                <div id="report-empty-message" style="text-align: center; color: var(--text-muted); padding: 40px 0; display: none;">
                    Nenhum médium corresponde aos critérios selecionados.
                </div>
            </div>
        </section>
        ` : ''}

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

        <!-- Seção Biblioteca -->
        <section id="section-library" class="hidden" style="margin-bottom: 40px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em;">Controle de Biblioteca</h2>
                <div class="tab-container" style="display: flex; gap: 6px; padding: 4px; background: rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                    <button id="btn-lib-subtab-loans" class="tab-button active" data-subtab="loans" style="padding: 8px 16px; font-size: 0.85rem; border-radius: 10px;">Empréstimos</button>
                    <button id="btn-lib-subtab-books" class="tab-button" data-subtab="books" style="padding: 8px 16px; font-size: 0.85rem; border-radius: 10px;">Acervo de Livros</button>
                </div>
            </div>

            <!-- Subseção Empréstimos -->
            <div id="lib-content-loans" class="animate-fade-in">
                <!-- Fila de Pedidos Pendentes de Retirada -->
                <div class="card animate-fade-in" style="background: var(--glass-bg); padding: 24px; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 30px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; font-weight: 700; font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <span>⏳</span> Retiradas Pendentes (Solicitações)
                    </h3>
                    <div id="lib-pending-loans-container" style="display: flex; flex-direction: column; gap: 12px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Carregando solicitações...</span>
                    </div>
                </div>

                <!-- Tabela de Empréstimos Ativos / Atrasados -->
                <div class="card animate-fade-in" style="background: var(--glass-bg); padding: 24px; border-radius: 20px; border: 1px solid var(--glass-border);">
                    <h3 style="margin-top: 0; margin-bottom: 15px; font-weight: 700; font-size: 1.15rem; color: #fff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span>📖</span> Empréstimos Ativos & Atrasados
                        <input type="text" id="lib-search-loans-input" placeholder="Buscar empréstimo..." style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; margin-bottom: 0; width: 220px; font-size: 0.85rem;">
                    </h3>
                    <div class="table-container" style="overflow-x: auto;">
                        <table class="admin-table" style="font-size: 0.85rem; width: 100%;">
                            <thead>
                                <tr>
                                    <th>Livro</th>
                                    <th>Nome do Aluno</th>
                                    <th>E-mail</th>
                                    <th>Data Retirada</th>
                                    <th>Prazo Limite</th>
                                    <th>Status</th>
                                    <th style="text-align: center;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="lib-active-loans-body">
                                <tr>
                                    <td colspan="7" style="text-align: center; color: var(--text-muted);">Carregando empréstimos...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Subseção Acervo de Livros -->
            <div id="lib-content-books" class="hidden animate-fade-in">
                <div class="card animate-fade-in" style="background: var(--glass-bg); padding: 24px; border-radius: 20px; border: 1px solid var(--glass-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                        <h3 style="margin: 0; font-weight: 700; font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 10px;">
                            <span>📚</span> Acervo Cadastrado
                            <input type="text" id="lib-search-books-input" placeholder="Buscar livro..." style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; margin-bottom: 0; width: 220px; font-size: 0.85rem;">
                        </h3>
                        <button id="btn-add-book" style="padding: 10px 18px; font-size: 0.85rem; border-radius: 10px;">
                            ➕ Adicionar Livro
                        </button>
                    </div>
                    <div class="table-container" style="overflow-x: auto;">
                        <table class="admin-table" style="font-size: 0.85rem; width: 100%;">
                            <thead>
                                <tr>
                                    <th>Capa</th>
                                    <th>Título</th>
                                    <th>Autor</th>
                                    <th>Categoria</th>
                                    <th>Localização Física</th>
                                    <th style="text-align: center;">Qtd Total</th>
                                    <th style="text-align: center;">Disponível</th>
                                    <th style="text-align: center;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="lib-books-table-body">
                                <tr>
                                    <td colspan="8" style="text-align: center; color: var(--text-muted);">Carregando acervo...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    `;

    if (hasFullAdminAccess && isMaster) {
        if (isMaster) {
            const membershipButton = document.createElement('button');
            membershipButton.className = 'tab-button'; membershipButton.dataset.tab = 'membership'; membershipButton.textContent = 'Vínculos e saídas';
            document.querySelector('.tab-container').append(membershipButton);
            const membershipSection = document.createElement('section'); membershipSection.id = 'section-membership'; membershipSection.className = 'hidden'; app.append(membershipSection);
        }
        const reflectionButton = document.createElement('button');
        reflectionButton.className = 'tab-button'; reflectionButton.dataset.tab = 'reflections'; reflectionButton.textContent = 'Reflexões de sábado';
        document.querySelector('.tab-container').append(reflectionButton);
        const reflectionSection = document.createElement('section'); reflectionSection.id = 'section-reflections'; reflectionSection.className = 'hidden';
        app.append(reflectionSection);
        const button = document.createElement('button');
        button.className = 'tab-button';
        button.dataset.tab = 'followup';
        button.textContent = 'Acompanhamento';
        document.querySelector('.tab-container').prepend(button);
        ['dashboard', 'finance'].forEach(section => {
            const shortcut = document.createElement('button');
            shortcut.textContent = 'Preparar lembretes e consultar contatos';
            shortcut.style.marginBottom = '20px';
            shortcut.addEventListener('click', () => switchTab('followup'));
            document.getElementById(`section-${section}`)?.prepend(shortcut);
        });
    }

    // Initialize globals
    window.allUsers = [];
    window.currentUserEmail = email;
    window.dashboardCarregado = false;
    window.reportsCarregados = false;
    window.reportUsers = [];
    window.reportUniqueRituals = [];
    window.chartEvolucaoInstance = null;
    window.chartTurmasInstance = null;

    // Modais e Container
    let modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) {
        modalsContainer = document.createElement('div');
        modalsContainer.id = 'modals-container';
        document.body.appendChild(modalsContainer);
    }

    // Remove existing modals if they exist to avoid event listener accumulation on DOM elements that persist
    const oldDetailsModal = document.getElementById('user-details-modal');
    if (oldDetailsModal) oldDetailsModal.remove();

    const oldVerificationModal = document.getElementById('finance-verification-modal');
    if (oldVerificationModal) oldVerificationModal.remove();

    const oldBulkModal = document.getElementById('bulk-presence-modal');
    if (oldBulkModal) oldBulkModal.remove();

    const oldBookModal = document.getElementById('book-editor-modal');
    if (oldBookModal) oldBookModal.remove();

    if (!document.getElementById('user-details-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
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
        `);
    }

    if (!document.getElementById('finance-verification-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="finance-verification-modal" class="modal">
                <div class="modal-content" style="max-width: 480px; width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Validar Pagamento</h2>
                        <span id="close-finance-verification" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>

                    <div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; margin-bottom:20px; font-size:0.9rem; line-height:1.4; border:1px solid rgba(255,255,255,0.05);">
                        <div><strong>Aluno:</strong> <span id="fv-student-name" style="color:#fff"></span></div>
                        <div><strong>E-mail:</strong> <span id="fv-student-email" style="color:var(--accent)"></span></div>
                        <div><strong>Mês de Referência:</strong> <span id="fv-month-ref" style="color:#fff"></span></div>
                        <div id="fv-receipt-link-container" style="margin-top:10px; display:none;">
                            <strong>Comprovante:</strong> <a id="fv-receipt-link" href="#" target="_blank" style="color:var(--accent); font-weight:600; text-decoration:none;">📎 Abrir Comprovante</a>
                        </div>
                        <div id="fv-obs-aluno-container" style="margin-top:10px; display:none;">
                            <strong>Observações Aluno:</strong> <div id="fv-obs-aluno" style="background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px; margin-top:4px; font-style:italic;"></div>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; color:#fff; font-size:0.9rem;">Observações da Validação (Admin):</label>
                        <textarea id="fv-obs-admin" rows="3" placeholder="Caso rejeite, explique o motivo..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; font-size: 0.9rem; outline: none; resize: vertical;"></textarea>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom: 12px;">
                        <button id="fv-btn-approve" style="padding:12px; font-weight:700; background:var(--success); color:#fff; border-radius:8px; border:none; cursor:pointer; width:100%;">
                            Aprovar Pagamento
                        </button>
                        <button id="fv-btn-reject" style="padding:12px; font-weight:700; background:#ef4444; color:#fff; border-radius:8px; border:none; cursor:pointer; width:100%;">
                            Recusar Comprovante
                        </button>
                    </div>
                    <button id="fv-btn-manual-pay" style="width:100%; padding:12px; font-weight:700; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:8px; cursor:pointer; margin-bottom:12px;">
                        Marcar como Pago (Sem Comprovante)
                    </button>
                    <button id="fv-btn-manual-unpay" style="width:100%; padding:12px; font-weight:700; background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.2); color:#f87171; border-radius:8px; cursor:pointer;">
                        Reverter para Em Aberto (Excluir)
                    </button>
                    <div id="finance-verification-feedback" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('bulk-presence-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="bulk-presence-modal" class="modal">
                <div class="modal-content" style="max-width: 650px; width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Chamada em Massa</h2>
                        <span id="close-bulk-presence" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1; cursor:pointer;">&times;</span>
                    </div>

                    <!-- Seletor de Modo -->
                    <div style="display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08);">
                        <button id="btn-tab-bulk-date" class="tab-button active" style="flex: 1; padding: 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">🗓️ Por Data / Turma</button>
                        <button id="btn-tab-bulk-medium" class="tab-button" style="flex: 1; padding: 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">👤 Por Médium</button>
                    </div>

                    <!-- Modo 1: Por Data / Turma -->
                    <div id="bulk-mode-date">
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
                                    <option value="domingo">Domingo</option>
                                    <option value="geral">Gira Geral</option>
                                </select>
                            </div>
                        </div>
                        
                        <button id="btn-load-bulk" style="width:100%; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-weight:600; cursor:pointer; margin-bottom: 20px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                            Carregar Lista de Médiuns
                        </button>
                    </div>

                    <!-- Modo 2: Por Médium -->
                    <div id="bulk-mode-medium" style="display:none;">
                        <div style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">Selecione o Médium</label>
                            <select id="bulk-medium-select" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; outline:none;">
                                <option value="">Selecione um médium...</option>
                            </select>
                        </div>

                        <button id="btn-load-bulk-medium" style="width:100%; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-weight:600; cursor:pointer; margin-bottom: 20px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                            Carregar Datas do Médium
                        </button>
                    </div>
                    
                    <!-- Container da Lista (reaproveitado para ambos os modos) -->
                    <div id="bulk-list-container" style="max-height: 40vh; overflow-y: auto; margin-bottom: 15px; display:flex; flex-direction:column; gap:8px;">
                        <div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione as opções acima e clique em Carregar.</div>
                    </div>

                    <!-- Área para Adicionar Data Específica (no modo por médium) -->
                    <div id="bulk-medium-add-date-container" style="display:none; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:20px;">
                        <label style="display:block; margin-bottom:8px; font-size:0.8rem; color:var(--text-muted); font-weight:600;">➕ Adicionar Outra Data para este Médium:</label>
                        <div style="display:flex; gap:10px;">
                            <input type="date" id="bulk-custom-date" style="flex:1; padding:8px 12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:0.85rem; outline:none;">
                            <button id="btn-add-custom-date" style="padding:8px 16px; background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.3); color:#34d399; font-weight:600; border-radius:8px; cursor:pointer; font-size:0.85rem;">
                                Adicionar Data
                            </button>
                        </div>
                    </div>

                    <div id="bulk-feedback" style="text-align:center; margin-bottom: 15px; font-size:0.9rem;"></div>

                    <button id="btn-save-bulk" style="width:100%; padding:14px; background:var(--primary); border:none; border-radius:10px; color:#fff; font-weight:700; cursor:pointer; display:none; transition: all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        Salvar Presenças
                    </button>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('book-editor-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="book-editor-modal" class="modal">
                <div class="modal-content" style="max-width: 550px; width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h2 id="book-modal-title" style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Cadastrar Livro</h2>
                        <span id="close-book-editor" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1; cursor:pointer;">&times;</span>
                    </div>

                    <input type="hidden" id="book-form-id">

                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Título do Livro *</label>
                        <input type="text" id="book-form-title" placeholder="Ex: O Livro dos Médiuns" style="margin-bottom: 0;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Autor</label>
                        <input type="text" id="book-form-author" placeholder="Ex: Allan Kardec" style="margin-bottom: 0;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Sinopse</label>
                        <textarea id="book-form-synopsis" rows="3" placeholder="Breve resumo sobre a leitura..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; font-size: 0.9rem; outline: none; resize: vertical;"></textarea>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">URL da Capa (Opcional)</label>
                        <input type="text" id="book-form-cover" placeholder="https://exemplo.com/capa.jpg" style="margin-bottom: 0;">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Categoria *</label>
                        <input type="text" id="book-form-category" placeholder="Ex: DIVERSOS, RELIGIÃO, MANGÁ" style="margin-bottom: 0;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 24px;">
                        <div>
                            <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Localização Física *</label>
                            <input type="text" id="book-form-location" placeholder="Ex: Prateleira B" style="margin-bottom: 0;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom: 6px; color:#fff; font-size:0.85rem;">Qtd Total Cópias *</label>
                            <input type="text" id="book-form-qty" placeholder="Ex: 2" value="1" style="margin-bottom: 0;">
                        </div>
                    </div>

                    <button id="btn-save-book" style="width: 100%; padding: 14px; font-size: 1rem; border-radius: 10px; display: flex; justify-content: center; align-items: center; gap: 8px; background: var(--primary); color: #fff; font-weight: 600; border: none; cursor: pointer;">
                        Salvar Livro
                    </button>
                    <div id="book-form-feedback" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></div>
                </div>
            </div>
        `);
    }

    // Bind UI Events
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('tuig_email');
        window.location.reload();
    });

    document.getElementById('btn-self-presence').addEventListener('click', () => markAdminPresence(email));

    const btnBulk = document.getElementById('btn-bulk-presence');
    if (btnBulk) {
        btnBulk.addEventListener('click', () => {
            const today = new Date();
            const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            document.getElementById('bulk-date').value = todayStr;
            document.getElementById('bulk-list-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione as opções acima e clique em Carregar.</div>';
            document.getElementById('btn-save-bulk').style.display = 'none';
            const addDateCont = document.getElementById('bulk-medium-add-date-container');
            if (addDateCont) addDateCont.style.display = 'none';
            document.getElementById('bulk-feedback').innerHTML = '';
            
            // Ativa a aba Por Data por padrão
            window.currentBulkMode = 'date';
            const tabDate = document.getElementById('btn-tab-bulk-date');
            const tabMedium = document.getElementById('btn-tab-bulk-medium');
            if (tabDate && tabMedium) {
                tabDate.classList.add('active');
                tabMedium.classList.remove('active');
                document.getElementById('bulk-mode-date').style.display = 'block';
                document.getElementById('bulk-mode-medium').style.display = 'none';
            }
            openModalById('bulk-presence-modal');
        });
    }

    const tabDate = document.getElementById('btn-tab-bulk-date');
    const tabMedium = document.getElementById('btn-tab-bulk-medium');
    if (tabDate && tabMedium) {
        tabDate.addEventListener('click', () => {
            window.currentBulkMode = 'date';
            tabDate.classList.add('active');
            tabMedium.classList.remove('active');
            document.getElementById('bulk-mode-date').style.display = 'block';
            document.getElementById('bulk-mode-medium').style.display = 'none';
            document.getElementById('bulk-medium-add-date-container').style.display = 'none';
            document.getElementById('bulk-list-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione a data/turma e clique em Carregar.</div>';
            document.getElementById('btn-save-bulk').style.display = 'none';
            document.getElementById('bulk-feedback').innerHTML = '';
        });

        tabMedium.addEventListener('click', () => {
            window.currentBulkMode = 'medium';
            tabMedium.classList.add('active');
            tabDate.classList.remove('active');
            document.getElementById('bulk-mode-medium').style.display = 'block';
            document.getElementById('bulk-mode-date').style.display = 'none';
            document.getElementById('bulk-medium-add-date-container').style.display = 'none';
            document.getElementById('bulk-list-container').innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Selecione um médium e clique em Carregar Datas.</div>';
            document.getElementById('btn-save-bulk').style.display = 'none';
            document.getElementById('bulk-feedback').innerHTML = '';
            populateBulkMediumSelect();
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

    const btnLoadBulkMedium = document.getElementById('btn-load-bulk-medium');
    if (btnLoadBulkMedium) {
        btnLoadBulkMedium.addEventListener('click', loadBulkPresenceListByMedium);
    }

    const btnAddCustomDate = document.getElementById('btn-add-custom-date');
    if (btnAddCustomDate) {
        btnAddCustomDate.addEventListener('click', addCustomDateToMediumList);
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

    document.getElementById('close-finance-verification').addEventListener('click', () => {
        closeModalById('finance-verification-modal');
    });
    document.getElementById('fv-btn-approve').addEventListener('click', () => submeterValidacao("Aprovado"));
    document.getElementById('fv-btn-reject').addEventListener('click', () => submeterValidacao("Rejeitado"));
    document.getElementById('fv-btn-manual-pay').addEventListener('click', () => submeterAjusteManual("Pago"));
    document.getElementById('fv-btn-manual-unpay').addEventListener('click', () => submeterAjusteManual("Em Aberto"));

    document.getElementById('finance-search-input').addEventListener('keyup', renderizarFinanceiro);
    document.getElementById('finance-turma-filter').addEventListener('change', renderizarFinanceiro);

    if (hasReportAccess) {
        document.getElementById('btn-export-reports-pdf').addEventListener('click', exportReportsPDF);
        document.getElementById('btn-export-reports-csv').addEventListener('click', exportReportsCSV);
        document.getElementById('report-selected-ritual').addEventListener('change', filtrarERenderizarRelatorio);
        document.getElementById('report-filter-condition').addEventListener('change', (e) => {
            const condition = e.target.value;
            const panel = document.getElementById('report-custom-filter-panel');
            if (condition === 'custom') {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
            filtrarERenderizarRelatorio();
        });
        document.getElementById('report-search-input').addEventListener('keyup', filtrarERenderizarRelatorio);
    }

    // Delegação de Eventos para os elementos dinâmicos das tabelas/listas
    const usersTableBody = document.getElementById('users-table-body');
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.details-btn');
            if (btn) {
                openUserDetails(btn.getAttribute('data-email'), btn.getAttribute('data-nome'));
            }
        });
    }

    const financeTableBody = document.getElementById('finance-table-body');
    if (financeTableBody) {
        financeTableBody.addEventListener('click', (e) => {
            const cell = e.target.closest('.finance-cell');
            if (cell) {
                const email = cell.getAttribute('data-email');
                const nome = cell.getAttribute('data-nome');
                const mes = cell.getAttribute('data-month');
                const link = cell.getAttribute('data-link');
                const obs = decodeURIComponent(cell.getAttribute('data-obs'));
                abrirModalVerificacao(email, nome, mes, link, obs);
            }
        });
    }

    const financePendingContainer = document.getElementById('finance-pending-container');
    if (financePendingContainer) {
        financePendingContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-verify-receipt-trigger');
            if (btn) {
                const email = btn.getAttribute('data-email');
                const nome = btn.getAttribute('data-nome');
                const mes = btn.getAttribute('data-month');
                const link = btn.getAttribute('data-link');
                const obs = decodeURIComponent(btn.getAttribute('data-obs'));
                abrirModalVerificacao(email, nome, mes, link, obs);
            }
        });
    }

    const bulkListContainer = document.getElementById('bulk-list-container');
    if (bulkListContainer) {
        bulkListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-presence');
            if (btn) {
                const idx = parseInt(btn.getAttribute('data-idx'));

                if (window.currentBulkMode === 'medium') {
                    const d = (window.currentBulkMediumDates || [])[idx];
                    if (!d) return;
                    if (d.originalPresent) {
                        btn.style.transform = 'scale(0.95)';
                        setTimeout(() => btn.style.transform = 'scale(1)', 150);
                        return;
                    }
                    d.isPresent = !d.isPresent;
                    renderBulkListByMedium(window.currentBulkMediumDates);
                } else {
                    const u = (window.currentBulkList || [])[idx];
                    if (!u) return;
                    if (u.originalPresent) {
                        btn.style.transform = 'scale(0.95)';
                        setTimeout(() => btn.style.transform = 'scale(1)', 150);
                        return;
                    }
                    u.isPresent = !u.isPresent;
                    renderBulkList(window.currentBulkList);
                }
            }
        });
    }

    if (hasReportAccess) {
        const mustHaveContainer = document.getElementById('custom-filter-must-have');
        if (mustHaveContainer) {
            mustHaveContainer.addEventListener('change', (e) => {
                if (e.target.tagName === 'INPUT') {
                    filtrarERenderizarRelatorio();
                }
            });
        }
        const mustNotHaveContainer = document.getElementById('custom-filter-must-not-have');
        if (mustNotHaveContainer) {
            mustNotHaveContainer.addEventListener('change', (e) => {
                if (e.target.tagName === 'INPUT') {
                    filtrarERenderizarRelatorio();
                }
            });
        }
    }

    // Fetch initial data
    if (hasFullAdminAccess) {
        fetchAdminData(email);
    } else {
        carregarRelatoriosRituais();
    }
}

async function fetchAdminData(email) {
    try {
        const json = await apiFetch('getAdminData', { params: { email } });

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
        const json = await apiFetch('getUserData', { params: { email: emailBusca } });

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
    if (['followup', 'reflections'].includes(tab) && localStorage.getItem('tuig_role') !== 'master_admin') return;
    document.getElementById('section-membership')?.classList.add('hidden');
    const reflectionSection = document.getElementById('section-reflections');
    if (reflectionSection) reflectionSection.classList.add('hidden');
    const adminSection = document.getElementById('section-admin');
    const studentSection = document.getElementById('section-student');
    const dashboardSection = document.getElementById('section-dashboard');
    const reportsSection = document.getElementById('section-reports');
    const financeSection = document.getElementById('section-finance');
    const librarySection = document.getElementById('section-library');
    const followupSection = document.getElementById('section-followup');

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-button[data-tab="${tab}"]`).classList.add('active');

    adminSection.classList.add('hidden');
    studentSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');
    if (reportsSection) reportsSection.classList.add('hidden');
    if (financeSection) financeSection.classList.add('hidden');
    if (librarySection) librarySection.classList.add('hidden');
    if (followupSection) followupSection.classList.add('hidden');

    const isMaster = (localStorage.getItem('tuig_role') || 'admin') === 'master_admin';

    if (tab === 'membership') {
        const section = document.getElementById('section-membership'); section.classList.remove('hidden');
        renderMembershipAdmin(section, window.currentUserEmail);
    } else if (tab === 'reflections' && reflectionSection) {
        reflectionSection.classList.remove('hidden');
        renderAdminReflections(reflectionSection, window.currentUserEmail);
    } else if (tab === 'followup') {
        followupSection.classList.remove('hidden');
        if (!followupSection.dataset.ready) renderFollowupCenter(followupSection, window.currentUserEmail);
    } else if (tab === 'admin') {
        adminSection.classList.remove('hidden');
    } else if (tab === 'finance') {
        if (financeSection && isMaster) {
            financeSection.classList.remove('hidden');
            carregarFinanceiro();
        }
    } else if (tab === 'student') {
        studentSection.classList.remove('hidden');
        // Renderiza visao de estudante na aba
        const container = document.getElementById('student-container');
        if (container.innerHTML === "") {
            renderStudentDashboard(window.currentUserEmail, 'student-container');
        }
    } else if (tab === 'dashboard') {
        if (isMaster) {
            dashboardSection.classList.remove('hidden');
            if (!window.dashboardCarregado) {
                carregarDashboard();
            }
        }
    } else if (tab === 'reports') {
        if (reportsSection) {
            reportsSection.classList.remove('hidden');
            if (!window.reportsCarregados) {
                carregarRelatoriosRituais();
            }
        }
    } else if (tab === 'library') {
        if (librarySection && isMaster) {
            librarySection.classList.remove('hidden');
            carregarBiblioteca();
        }
    }
}

async function carregarDashboard() {
    const btnEx = document.getElementById('btn-export-pdf');
    if (btnEx) btnEx.innerText = "Carregando...";

    try {
        const json = await apiFetch('getDashboardStats');

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
                labels: ['Sexta-feira', 'Sábado', 'Domingo'],
                datasets: [{
                    label: 'Assiduidade Média',
                    data: [stats.barChart.sexta, stats.barChart.sabado, stats.barChart.domingo || 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#818cf8'],
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
    document.body.style.background = '#020617';

    // Configura fundo escuro temporário para o PDF ficar legível e bonito
    section.style.background = '#020617';
    section.style.padding = '20px';
    section.style.borderRadius = '12px';

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
        section.style.background = '';
        section.style.padding = '';
        section.style.borderRadius = '';
    }).catch(err => {
        console.error("Erro ao gerar PDF:", err);
        btn.style.display = 'block';
        document.body.style.background = oldBg;
        section.style.background = '';
        section.style.padding = '';
        section.style.borderRadius = '';
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

function markAdminPresence(targetId) {
    const btn = document.getElementById('btn-self-presence');
    const msg = document.getElementById('gps-msg');
    const dot = document.getElementById('gps-dot');

    btn.disabled = true;
    msg.innerText = "Obtendo localização...";
    dot.classList.remove('hidden');

    if (!navigator.geolocation) {
        showPresenceError("GPS não suportado neste aparelho.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const data = {
                action: 'registerPresence',
                data: {
                    studentEmail: targetId,
                    registeredBy: targetId,
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    deviceId: getDeviceId()
                }
            };

            try {
                const res = await apiFetch('registerPresence', {
                    method: 'POST',
                    data: {
                        studentEmail: targetId,
                        registeredBy: targetId,
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        deviceId: getDeviceId()
                    }
                });

                if (res.status === "success") {
                    btn.innerHTML = "✅ Presença Confirmada!";
                    msg.innerText = res.message;
                    msg.style.color = res.withinRadius ? "#10b981" : "#ef4444";

                    if (!res.withinRadius) dot.style.background = "#ef4444";
                    else dot.style.background = "#10b981";
                    dot.classList.remove('hidden');
                } else {
                    showPresenceError(res.message);
                }
            } catch (err) {
                showPresenceError("Erro de conexão com o servidor.");
            }
        },
        (err) => {
            console.error("Erro GPS:", err);
            showPresenceError("Erro ao acessar GPS. Verifique as permissões.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function showPresenceError(errorText) {
    const btn = document.getElementById('btn-self-presence');
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
        const json = await apiFetch('getBulkPresenceList', { params: { date: dateVal, turma: turmaVal } });

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
}

function populateBulkMediumSelect() {
    const select = document.getElementById('bulk-medium-select');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um médium...</option>';

    const users = (window.allUsers || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    users.forEach(u => {
        if (!u.email) return;
        const opt = document.createElement('option');
        opt.value = u.email;
        opt.textContent = `${u.nome} (${u.email}) - ${u.turma || 'Sem turma'}`;
        select.appendChild(opt);
    });
}

async function loadBulkPresenceListByMedium() {
    const mediumSelect = document.getElementById('bulk-medium-select');
    const mediumEmail = mediumSelect ? mediumSelect.value : '';
    const container = document.getElementById('bulk-list-container');
    const btnSave = document.getElementById('btn-save-bulk');
    const feedback = document.getElementById('bulk-feedback');
    const btnLoad = document.getElementById('btn-load-bulk-medium');
    const addDateContainer = document.getElementById('bulk-medium-add-date-container');

    if (!mediumEmail) {
        feedback.innerHTML = '<span style="color:#ef4444">Selecione um médium.</span>';
        return;
    }

    feedback.innerHTML = '';
    btnLoad.innerText = 'Carregando...';
    btnLoad.disabled = true;
    container.innerHTML = '<div class="loader active"></div>';
    btnSave.style.display = 'none';
    if (addDateContainer) addDateContainer.style.display = 'none';

    try {
        const json = await apiFetch('getBulkPresenceListByMedium', { params: { mediumEmail } });

        if (json.status === "success" && json.data) {
            window.currentBulkMedium = json.data.medium;
            window.currentBulkMediumDates = json.data.dates || [];

            if (window.currentBulkMediumDates.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Nenhuma data de gira encontrada para este médium. Você pode adicionar datas manualmente abaixo.</div>';
            } else {
                renderBulkListByMedium(window.currentBulkMediumDates);
            }

            if (addDateContainer) addDateContainer.style.display = 'block';
            btnSave.style.display = 'block';
        } else {
            container.innerHTML = `<div style="color:#ef4444; text-align:center;">${json.message || 'Erro ao carregar datas.'}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:#ef4444; text-align:center;">Erro de conexão com o servidor.</div>`;
    } finally {
        btnLoad.innerText = 'Carregar Datas do Médium';
        btnLoad.disabled = false;
    }
}

function renderBulkListByMedium(dates) {
    const container = document.getElementById('bulk-list-container');
    if (!dates || dates.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Nenhuma data cadastrada. Use o campo abaixo para adicionar.</div>';
        return;
    }

    let html = '';
    dates.forEach((d, idx) => {
        const isPresent = d.isPresent;
        const color = isPresent ? '#10b981' : 'rgba(255,255,255,0.2)';
        const bg = isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)';
        const cursor = d.originalPresent ? 'default' : 'pointer';
        const opacity = d.originalPresent ? '0.7' : '1';

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; opacity: ${opacity};">
                <div>
                    <div style="font-weight:700; color:#fff; font-size:0.95rem;">📅 ${d.dateStr}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:500; text-transform:uppercase;">Turma: ${d.turma}</div>
                </div>
                <div class="toggle-presence" data-idx="${idx}" style="cursor:${cursor}; display:flex; align-items:center; gap:8px; background:${bg}; padding:6px 12px; border-radius:20px; border:1px solid ${color}; transition:all 0.3s;">
                    <div style="width:12px; height:12px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${isPresent ? '#10b981' : 'transparent'};"></div>
                    <span style="font-size:0.8rem; font-weight:700; color:${isPresent ? '#10b981' : 'var(--text-muted)'}">${isPresent ? 'Presente' : 'Faltou'}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function addCustomDateToMediumList() {
    const input = document.getElementById('bulk-custom-date');
    const feedback = document.getElementById('bulk-feedback');
    if (!input || !input.value) {
        feedback.innerHTML = '<span style="color:#ef4444">Selecione uma data para adicionar.</span>';
        return;
    }

    const partes = input.value.split('-');
    const dateStr = `${partes[2]}/${partes[1]}/${partes[0]}`;

    if (!window.currentBulkMediumDates) window.currentBulkMediumDates = [];

    const exists = window.currentBulkMediumDates.some(d => d.dateStr === dateStr);
    if (exists) {
        feedback.innerHTML = '<span style="color:#f59e0b">Essa data já está na lista.</span>';
        return;
    }

    const newDateObj = {
        dateStr: dateStr,
        isoDate: input.value,
        rawTime: new Date(partes[0], partes[1] - 1, partes[2]).getTime(),
        turma: "Manual",
        isPresent: true,
        originalPresent: false
    };

    window.currentBulkMediumDates.unshift(newDateObj);
    renderBulkListByMedium(window.currentBulkMediumDates);
    input.value = '';
    feedback.innerHTML = '<span style="color:#10b981">Data adicionada e marcada como presente!</span>';
    setTimeout(() => { feedback.innerHTML = ''; }, 2000);
}

async function saveBulkPresenceList(adminEmail) {
    const feedback = document.getElementById('bulk-feedback');
    const btnSave = document.getElementById('btn-save-bulk');

    if (window.currentBulkMode === 'medium') {
        const dates = window.currentBulkMediumDates;
        const medium = window.currentBulkMedium;

        if (!dates || !medium) return;

        const newPresences = dates.filter(d => d.isPresent && !d.originalPresent);

        if (newPresences.length === 0) {
            feedback.innerHTML = '<span style="color:var(--text-muted)">Nenhuma nova presença para salvar.</span>';
            setTimeout(() => closeModalById('bulk-presence-modal'), 1500);
            return;
        }

        btnSave.innerText = 'Salvando...';
        btnSave.disabled = true;
        feedback.innerHTML = '';

        try {
            const res = await apiFetch('saveBulkPresenceByMedium', {
                method: 'POST',
                data: {
                    mediumEmail: medium.email,
                    mediumNome: medium.nome,
                    adminEmail: adminEmail,
                    presences: newPresences
                }
            });

            if (res.status === "success") {
                feedback.innerHTML = `<span style="color:#10b981">✅ ${res.message}</span>`;
                newPresences.forEach(d => d.originalPresent = true);
                renderBulkListByMedium(window.currentBulkMediumDates);

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

        return;
    }

    const list = window.currentBulkList;
    if (!list) return;

    // Filtra apenas os que mudaram de falso para verdadeiro (ou seja, os novos presentes marcados agora)
    const newPresences = list.filter(u => u.isPresent && !u.originalPresent);

    if (newPresences.length === 0) {
        feedback.innerHTML = '<span style="color:var(--text-muted)">Nenhuma nova presença para salvar.</span>';
        setTimeout(() => closeModalById('bulk-presence-modal'), 1500);
        return;
    }

    const dateVal = document.getElementById('bulk-date').value;

    btnSave.innerText = 'Salvando...';
    btnSave.disabled = true;
    feedback.innerHTML = '';

    try {
        const res = await apiFetch('saveBulkPresence', {
            method: 'POST',
            data: {
                date: dateVal,
                adminEmail: adminEmail,
                presences: newPresences
            }
        });

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

async function carregarRelatoriosRituais() {
    const loader = document.getElementById('report-loader');
    const tableContainer = document.getElementById('report-table-container');
    const emptyMsg = document.getElementById('report-empty-message');
    const resultsCount = document.getElementById('report-results-count');
    
    loader.classList.add('active');
    tableContainer.style.display = 'none';
    emptyMsg.style.display = 'none';
    resultsCount.innerText = 'Buscando dados no servidor...';
    
    try {
        const email = window.currentUserEmail;
        const json = await apiFetch('getRitualsReport', { params: { email } });
        
        if (json.status === 'success') {
            window.reportsCarregados = true;
            window.reportUsers = json.data.users;
            window.reportUniqueRituals = json.data.uniqueRituals;
            
            // Popula o select de rituais
            const select = document.getElementById('report-selected-ritual');
            let selectHtml = '';
            window.reportUniqueRituals.forEach(r => {
                selectHtml += `<option value="${r}">${r}</option>`;
            });
            select.innerHTML = selectHtml;
            
            // Popula os checkboxes de filtros personalizados
            const mustHaveContainer = document.getElementById('custom-filter-must-have');
            const mustNotHaveContainer = document.getElementById('custom-filter-must-not-have');
            
            let mustHaveHtml = '';
            let mustNotHaveHtml = '';
            
            window.reportUniqueRituals.forEach((r, idx) => {
                mustHaveHtml += `
                    <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#fff; cursor:pointer;">
                        <input type="checkbox" class="report-must-have-cb" value="${r}" style="width:auto; margin-bottom:0;">
                        <span>${r}</span>
                    </label>
                `;
                mustNotHaveHtml += `
                    <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#fff; cursor:pointer;">
                        <input type="checkbox" class="report-must-not-have-cb" value="${r}" style="width:auto; margin-bottom:0;">
                        <span>${r}</span>
                    </label>
                `;
            });
            
            mustHaveContainer.innerHTML = mustHaveHtml;
            mustNotHaveContainer.innerHTML = mustNotHaveHtml;
            
            filtrarERenderizarRelatorio();
        } else {
            resultsCount.innerText = 'Erro ao carregar relatório';
            resultsCount.style.color = '#ef4444';
            loader.classList.remove('active');
            alert(json.message);
        }
    } catch (e) {
        resultsCount.innerText = 'Erro ao carregar relatório';
        resultsCount.style.color = '#ef4444';
        loader.classList.remove('active');
        console.error(e);
        alert('Erro ao carregar dados do relatório.');
    }
}

function filtrarERenderizarRelatorio() {
    const selectedRitual = document.getElementById('report-selected-ritual').value;
    const condition = document.getElementById('report-filter-condition').value;
    const searchTerm = document.getElementById('report-search-input').value.toLowerCase().trim();
    
    const loader = document.getElementById('report-loader');
    const tableContainer = document.getElementById('report-table-container');
    const emptyMsg = document.getElementById('report-empty-message');
    const resultsCount = document.getElementById('report-results-count');
    const tbody = document.getElementById('report-table-body');
    
    // Filtro personalizado por checkboxes
    const mustHaveCheckboxes = Array.from(document.querySelectorAll('.report-must-have-cb:checked')).map(cb => cb.value);
    const mustNotHaveCheckboxes = Array.from(document.querySelectorAll('.report-must-not-have-cb:checked')).map(cb => cb.value);
    
    const filtered = window.reportUsers.filter(user => {
        // 1. Filtrar por termo de busca
        if (searchTerm) {
            const searchString = (user.nome + " " + user.email + " " + user.turma).toLowerCase();
            if (!searchString.includes(searchTerm)) return false;
        }
        
        const userRitualNames = user.rituals.map(r => r.nome);
        
        // 2. Filtrar por condição de ritual
        if (condition === 'only') {
            // Possui apenas o ritual selecionado e nenhum outro
            if (userRitualNames.length !== 1) return false;
            if (userRitualNames[0] !== selectedRitual) return false;
        } else if (condition === 'has') {
            // Possui o ritual selecionado (mesmo que possua outros)
            if (!userRitualNames.includes(selectedRitual)) return false;
        } else if (condition === 'not_has') {
            // Não possui o ritual selecionado
            if (userRitualNames.includes(selectedRitual)) return false;
        } else if (condition === 'custom') {
            // Filtro Personalizado por checkboxes (AND e NOR)
            // Deve possuir todos os rituais marcados em "mustHaveCheckboxes"
            for (let req of mustHaveCheckboxes) {
                if (!userRitualNames.includes(req)) return false;
            }
            // NÃO deve possuir nenhum dos rituais marcados em "mustNotHaveCheckboxes"
            for (let forbidden of mustNotHaveCheckboxes) {
                if (userRitualNames.includes(forbidden)) return false;
            }
        }
        
        return true;
    });
    
    // Renderizar
    loader.classList.remove('active');
    resultsCount.innerText = `${filtered.length} médium(ns) encontrado(s)`;
    
    if (filtered.length === 0) {
        tableContainer.style.display = 'none';
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        tableContainer.style.display = 'block';
        
        let html = '';
        filtered.forEach(u => {
            let ritualsHtml = '';
            if (u.rituals && u.rituals.length > 0) {
                // Ordena os rituais por data decrescente
                const sortedRituals = [...u.rituals].sort((a, b) => new Date(b.data) - new Date(a.data));
                sortedRituals.forEach(r => {
                    const d = new Date(r.data);
                    const formattedDate = isNaN(d.getTime()) ? r.data : d.toLocaleDateString('pt-BR');
                    ritualsHtml += `
                        <div style="margin-bottom: 6px; display:flex; align-items:center; gap:8px;">
                            <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: var(--accent); border: 1px solid rgba(99, 102, 241, 0.3); font-size: 0.75rem;">${r.nome}</span>
                            <span style="font-size:0.8rem; color: var(--text-muted);">${formattedDate}</span>
                            ${r.notas ? `<span style="font-size:0.75rem; color: #64748b; font-style: italic;">(${r.notas})</span>` : ''}
                        </div>
                    `;
                });
            } else {
                ritualsHtml = '<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhum ritual cadastrado</span>';
            }
            
            html += `
                <tr class="user-row">
                    <td data-label="Nome / Turma">
                        <div style="font-weight:700; color:#fff; font-size:1.05rem; letter-spacing:-0.01em;">${u.nome}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
                            Turma: <span style="color:var(--accent)">${u.turma || 'N/A'}</span>
                        </div>
                    </td>
                    <td data-label="E-mail" style="color:var(--text-muted); font-size:0.85rem; word-break: break-word; overflow-wrap: anywhere; font-weight:400;">${u.email}</td>
                    <td data-label="Rituais Realizados">
                        <div style="display:flex; flex-direction:column; gap:4px; align-items: flex-start;">${ritualsHtml}</div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }
}

function exportReportsPDF() {
    if (!window.html2pdf) {
        alert("O gerador de PDF está carregando, tente novamente em instantes.");
        return;
    }

    const section = document.getElementById('section-reports');
    const filterCard = document.querySelector('#section-reports .card');
    const searchWrapper = document.getElementById('report-search-input').parentElement;
    const btnPdf = document.getElementById('btn-export-reports-pdf');
    const btnCsv = document.getElementById('btn-export-reports-csv');

    btnPdf.style.display = 'none';
    btnCsv.style.display = 'none';
    if (filterCard) filterCard.style.display = 'none';
    if (searchWrapper) searchWrapper.style.display = 'none';
    
    const oldBg = document.body.style.background;
    document.body.style.background = '#020617';

    // Configura fundo escuro temporário para o PDF ficar legível e bonito
    section.style.background = '#020617';
    section.style.padding = '20px';
    section.style.borderRadius = '12px';

    var opt = {
        margin: 10,
        filename: 'Relatorio_Rituais_TUIG.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(section).save().then(() => {
        btnPdf.style.display = 'inline-flex';
        btnCsv.style.display = 'inline-flex';
        if (filterCard) filterCard.style.display = 'block';
        if (searchWrapper) searchWrapper.style.display = 'block';
        document.body.style.background = oldBg;
        section.style.background = '';
        section.style.padding = '';
        section.style.borderRadius = '';
    }).catch(err => {
        console.error("Erro ao gerar PDF:", err);
        btnPdf.style.display = 'inline-flex';
        btnCsv.style.display = 'inline-flex';
        if (filterCard) filterCard.style.display = 'block';
        if (searchWrapper) searchWrapper.style.display = 'block';
        document.body.style.background = oldBg;
        section.style.background = '';
        section.style.padding = '';
        section.style.borderRadius = '';
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
    });
}

function exportReportsCSV() {
    const selectedRitual = document.getElementById('report-selected-ritual').value;
    const condition = document.getElementById('report-filter-condition').value;
    const searchTerm = document.getElementById('report-search-input').value.toLowerCase().trim();
    
    const mustHaveCheckboxes = Array.from(document.querySelectorAll('.report-must-have-cb:checked')).map(cb => cb.value);
    const mustNotHaveCheckboxes = Array.from(document.querySelectorAll('.report-must-not-have-cb:checked')).map(cb => cb.value);
    
    const filtered = window.reportUsers.filter(user => {
        if (searchTerm) {
            const searchString = (user.nome + " " + user.email + " " + user.turma).toLowerCase();
            if (!searchString.includes(searchTerm)) return false;
        }
        
        const userRitualNames = user.rituals.map(r => r.nome);
        
        if (condition === 'only') {
            if (userRitualNames.length !== 1) return false;
            if (userRitualNames[0] !== selectedRitual) return false;
        } else if (condition === 'has') {
            if (!userRitualNames.includes(selectedRitual)) return false;
        } else if (condition === 'not_has') {
            if (userRitualNames.includes(selectedRitual)) return false;
        } else if (condition === 'custom') {
            for (let req of mustHaveCheckboxes) {
                if (!userRitualNames.includes(req)) return false;
            }
            for (let forbidden of mustNotHaveCheckboxes) {
                if (userRitualNames.includes(forbidden)) return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        alert("Nenhum dado para exportar.");
        return;
    }

    let csvContent = "\uFEFFNome;Email;Turma;Rituais\r\n";
    
    filtered.forEach(u => {
        const ritualsStr = u.rituals.map(r => {
            const d = new Date(r.data);
            const formattedDate = isNaN(d.getTime()) ? r.data : d.toLocaleDateString('pt-BR');
            return `${r.nome} (${formattedDate})`;
        }).join(" | ");
        
        const nomeEscaped = u.nome.replace(/"/g, '""');
        const emailEscaped = u.email.replace(/"/g, '""');
        const turmaEscaped = u.turma.replace(/"/g, '""');
        const ritualsEscaped = ritualsStr.replace(/"/g, '""');
        
        csvContent += `"${nomeEscaped}";"${emailEscaped}";"${turmaEscaped}";"${ritualsEscaped}"\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_rituais_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// FUNÇÕES DO PAINEL FINANCEIRO (ADMIN)
// ==========================================

async function carregarFinanceiro() {
    const pendingContainer = document.getElementById('finance-pending-container');
    const tableBody = document.getElementById('finance-table-body');
    
    if (pendingContainer) pendingContainer.innerHTML = '<div class="loader active"></div>';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" style="text-align:center;"><div class="loader active"></div></td></tr>';
    
    try {
        const json = await apiFetch('getFinancialReport', { params: { email: window.currentUserEmail } });
        
        if (json.status === "success") {
            window.financeData = json.data;
            renderizarFinanceiro();
        } else {
            showFinanceError(json.message);
        }
    } catch (err) {
        showFinanceError("Erro ao conectar com o servidor.");
    }
}

function renderizarFinanceiro() {
    const pendingContainer = document.getElementById('finance-pending-container');
    const tableBody = document.getElementById('finance-table-body');
    const searchVal = document.getElementById('finance-search-input').value.toLowerCase();
    const turmaVal = document.getElementById('finance-turma-filter').value;
    
    if (!window.financeData) return;
    
    // 1. Renderizar Comprovantes Pendentes
    const pending = window.financeData.pending || [];
    if (pending.length === 0) {
        pendingContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px 0; display: block;">Nenhum comprovante pendente de validação.</span>';
    } else {
        let pendingHtml = '';
        pending.forEach(p => {
            pendingHtml += `
                <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.05); padding: 18px 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: 700; color: #fff; font-size: 1rem;">${p.nome}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">
                            Mês: <strong style="color: var(--accent)">${p.mes}</strong> | E-mail: ${p.email}
                        </div>
                        ${p.obsAluno ? `
                        <div style="margin-top: 8px; font-size: 0.8rem; color: #cbd5e1; background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--primary); max-width: 100%;">
                            <strong>Obs Aluno:</strong> "${p.obsAluno}"
                        </div>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="${p.link}" target="_blank" style="padding: 10px 14px; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 10px; cursor: pointer; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                            📎 Ver Arquivo
                        </a>
                        <button class="btn-verify-receipt-trigger" data-email="${p.email}" data-nome="${p.nome}" data-month="${p.mes}" data-link="${p.link}" data-obs="${encodeURIComponent(p.obsAluno || "")}" style="padding: 10px 14px; font-size: 0.8rem; background: var(--primary); color: #fff; border-radius: 10px; cursor: pointer; font-weight: 600; border: none;">
                            Validar ⚖️
                        </button>
                    </div>
                </div>
            `;
        });
        pendingContainer.innerHTML = pendingHtml;
    }
    
    // 2. Renderizar Tabela de Mensalidades (Matrix)
    const users = window.financeData.users || [];
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const filteredUsers = users.filter(u => {
        const matchesSearch = !searchVal || normalizeText(u.nome + " " + u.email).includes(normalizeText(searchVal));
        
        let matchesTurma = true;
        if (turmaVal !== 'all') {
            const uTurmaNorm = normalizeText(u.turma);
            matchesTurma = uTurmaNorm.includes(normalizeText(turmaVal));
        }
        
        return matchesSearch && matchesTurma;
    });
    
    if (filteredUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum aluno encontrado com os filtros selecionados.</td></tr>';
        return;
    }
    
    let rowsHtml = '';
    filteredUsers.forEach(u => {
        let cellsHtml = `
            <td style="padding: 12px 14px; text-align: left; vertical-align: middle;">
                <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${u.nome}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Turma: ${u.turma || "Não informada"}</div>
            </td>
        `;
        
        meses.forEach((m, monthIndex) => {
            const payInfo = u.payments ? u.payments[m] : null;
            const closedMonth = monthIndex < new Date().getMonth();
            let symbol = closedMonth ? "—" : "·";
            let color = closedMonth ? "#fbbf24" : "#94a3b8";
            let link = "";
            let obsAluno = "";
            let description = closedMonth ? 'Sem pagamento registrado — conferir antes de cobrar' : 'Mês em andamento ou futuro — não classificado como atraso';
            if (u.pausedMonths?.[monthIndex] && !payInfo) { symbol = '⏸'; color = '#94a3b8'; description = 'Mês com afastamento ou desligamento — sem lembrete automático'; }
            
            if (payInfo) {
                link = payInfo.link || "";
                obsAluno = payInfo.obsAluno || "";
                if (payInfo.status === "Aprovado" || payInfo.status === "Pago") {
                    symbol = "✅";
                    color = "#10b981";
                    description = 'Pagamento confirmado';
                } else if (payInfo.status === "Pendente") {
                    symbol = "⏳";
                    color = "#f59e0b";
                    description = 'Comprovante aguardando análise';
                }
            }
            
            cellsHtml += `
                <td class="finance-cell" data-email="${u.email}" data-nome="${u.nome}" data-month="${m}" data-link="${link}" data-obs="${encodeURIComponent(obsAluno)}" style="text-align: center; vertical-align: middle; padding: 12px 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    <span title="${description}" aria-label="${description}" style="font-size: 1.15rem; color: ${color}; filter: drop-shadow(0 0 4px ${color}30);">${symbol}</span>
                </td>
            `;
        });
        
        rowsHtml += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">${cellsHtml}</tr>`;
    });
    tableBody.innerHTML = rowsHtml;
}

function abrirModalVerificacao(email, nome, mes, link, obs) {
    window.currentFVEmail = email;
    window.currentFVName = nome;
    window.currentFVMonth = mes;
    
    document.getElementById('fv-student-name').innerText = nome;
    document.getElementById('fv-student-email').innerText = email;
    document.getElementById('fv-month-ref').innerText = mes;
    
    const linkContainer = document.getElementById('fv-receipt-link-container');
    const linkEl = document.getElementById('fv-receipt-link');
    if (link) {
        linkContainer.style.display = 'block';
        linkEl.href = link;
    } else {
        linkContainer.style.display = 'none';
    }
    
    const obsContainer = document.getElementById('fv-obs-aluno-container');
    const obsEl = document.getElementById('fv-obs-aluno');
    if (obs && obs.trim() !== "") {
        obsContainer.style.display = 'block';
        obsEl.innerText = obs;
    } else {
        obsContainer.style.display = 'none';
    }
    
    document.getElementById('fv-obs-admin').value = '';
    document.getElementById('finance-verification-feedback').innerHTML = '';
    
    openModalById('finance-verification-modal');
}

async function submeterValidacao(status) {
    const obs = document.getElementById('fv-obs-admin').value.trim();
    const feedback = document.getElementById('finance-verification-feedback');
    
    if (status === "Rejeitado" && !obs) {
        feedback.innerHTML = '<span style="color:var(--danger)">Por favor, justifique o motivo da recusa.</span>';
        return;
    }
    
    const btnId = status === "Aprovado" ? "fv-btn-approve" : "fv-btn-reject";
    const btn = document.getElementById(btnId);
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Enviando...';
    btn.disabled = true;
    
    try {
        const json = await apiFetch('verifyPayment', {
            method: 'POST',
            data: {
                adminEmail: window.currentUserEmail,
                studentEmail: window.currentFVEmail,
                mes: window.currentFVMonth,
                ano: new Date().getFullYear(),
                status: status,
                obs: obs
            }
        });
        if (json.status === "success") {
            feedback.innerHTML = `<span style="color:var(--success)">Comprovante ${status === "Aprovado" ? "Aprovado" : "Recusado"} com sucesso!</span>`;
            setTimeout(() => {
                closeModalById('finance-verification-modal');
                carregarFinanceiro();
            }, 2000);
        } else {
            feedback.innerHTML = `<span style="color:var(--danger)">Erro: ${json.message}</span>`;
        }
    } catch (err) {
        feedback.innerHTML = '<span style="color:var(--danger)">Erro de conexão com o servidor.</span>';
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function submeterAjusteManual(status) {
    const feedback = document.getElementById('finance-verification-feedback');
    const btnId = status === "Pago" ? "fv-btn-manual-pay" : "fv-btn-manual-unpay";
    const btn = document.getElementById(btnId);
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Enviando...';
    btn.disabled = true;
    
    try {
        const json = await apiFetch('setPaymentStatusManual', {
            method: 'POST',
            data: {
                adminEmail: window.currentUserEmail,
                studentEmail: window.currentFVEmail,
                nome: window.currentFVName,
                mes: window.currentFVMonth,
                ano: new Date().getFullYear(),
                status: status
            }
        });
        if (json.status === "success") {
            feedback.innerHTML = '<span style="color:var(--success)">Ajuste manual salvo com sucesso!</span>';
            setTimeout(() => {
                closeModalById('finance-verification-modal');
                carregarFinanceiro();
            }, 2000);
        } else {
            feedback.innerHTML = `<span style="color:var(--danger)">Erro: ${json.message}</span>`;
        }
    } catch (err) {
        feedback.innerHTML = '<span style="color:var(--danger)">Erro de conexão com o servidor.</span>';
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showFinanceError(msg) {
    const pendingContainer = document.getElementById('finance-pending-container');
    const tableBody = document.getElementById('finance-table-body');
    if (pendingContainer) pendingContainer.innerHTML = `<span style="color:#ef4444">${msg}</span>`;
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:#ef4444;">${msg}</td></tr>`;
}

// ==========================================
// SEÇÃO DE BIBLIOTECA - PAINEL ADMINISTRATIVO
// ==========================================

export async function carregarBiblioteca() {
    if (!window.libraryAdminInitialized) {
        window.libraryAdminInitialized = true;

        const btnSubLoans = document.getElementById('btn-lib-subtab-loans');
        const btnSubBooks = document.getElementById('btn-lib-subtab-books');
        const panelLoans = document.getElementById('lib-content-loans');
        const panelBooks = document.getElementById('lib-content-books');

        if (btnSubLoans && btnSubBooks && panelLoans && panelBooks) {
            btnSubLoans.addEventListener('click', () => {
                btnSubLoans.classList.add('active');
                btnSubBooks.classList.remove('active');
                panelLoans.classList.remove('hidden');
                panelBooks.classList.add('hidden');
                renderLibLoans();
            });

            btnSubBooks.addEventListener('click', () => {
                btnSubBooks.classList.add('active');
                btnSubLoans.classList.remove('active');
                panelBooks.classList.remove('hidden');
                panelLoans.classList.add('hidden');
                renderLibBooks();
            });
        }

        const searchLoansInput = document.getElementById('lib-search-loans-input');
        if (searchLoansInput) {
            searchLoansInput.addEventListener('keyup', (e) => {
                renderLibLoans(e.target.value);
            });
        }

        const searchBooksInput = document.getElementById('lib-search-books-input');
        if (searchBooksInput) {
            searchBooksInput.addEventListener('keyup', (e) => {
                renderLibBooks(e.target.value);
            });
        }

        const btnAddBook = document.getElementById('btn-add-book');
        if (btnAddBook) {
            btnAddBook.addEventListener('click', () => {
                document.getElementById('book-modal-title').innerText = "Cadastrar Livro";
                document.getElementById('book-form-id').value = "";
                document.getElementById('book-form-title').value = "";
                document.getElementById('book-form-author').value = "";
                document.getElementById('book-form-synopsis').value = "";
                document.getElementById('book-form-cover').value = "";
                document.getElementById('book-form-category').value = "";
                document.getElementById('book-form-location').value = "";
                document.getElementById('book-form-qty').value = "1";
                document.getElementById('book-form-feedback').innerHTML = "";
                openModalById('book-editor-modal');
            });
        }

        const closeBookBtn = document.getElementById('close-book-editor');
        if (closeBookBtn) {
            closeBookBtn.addEventListener('click', () => {
                closeModalById('book-editor-modal');
            });
        }

        const btnSaveBook = document.getElementById('btn-save-book');
        if (btnSaveBook) {
            btnSaveBook.addEventListener('click', saveBookForm);
        }
    }

    const pendingContainer = document.getElementById('lib-pending-loans-container');
    const activeLoansBody = document.getElementById('lib-active-loans-body');
    const booksTableBody = document.getElementById('lib-books-table-body');

    if (pendingContainer) pendingContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Carregando dados...</span>';
    if (activeLoansBody) activeLoansBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Carregando...</td></tr>';
    if (booksTableBody) booksTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Carregando...</td></tr>';

    try {
        const json = await apiFetch('getBooksData', { params: { email: window.currentUserEmail } });
        if (json.status === 'success') {
            window.adminLibraryData = {
                books: json.books || [],
                loans: json.loans || []
            };

            const btnSubLoans = document.getElementById('btn-lib-subtab-loans');
            if (btnSubLoans && btnSubLoans.classList.contains('active')) {
                renderLibLoans();
            } else {
                renderLibBooks();
            }
        } else {
            alert("Erro ao buscar dados da biblioteca: " + json.message);
        }
    } catch (e) {
        console.error("Erro ao carregar biblioteca:", e);
        alert("Erro ao conectar com o servidor.");
    }
}

function renderLibLoans(filterQuery = '') {
    const pendingContainer = document.getElementById('lib-pending-loans-container');
    const activeLoansBody = document.getElementById('lib-active-loans-body');

    if (!window.adminLibraryData) return;

    const query = filterQuery.toLowerCase().trim();
    const loans = window.adminLibraryData.loans;

    const pendingLoans = loans.filter(l => l.status === 'Solicitado');
    if (pendingContainer) {
        pendingContainer.innerHTML = '';
        if (pendingLoans.length === 0) {
            pendingContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Nenhuma retirada pendente no momento.</span>';
        } else {
            pendingLoans.forEach(loan => {
                const book = window.adminLibraryData.books.find(b => b.id === loan.livroId);
                const locationStr = book ? book.localizacao : 'Não especificado';
                const row = document.createElement('div');
                row.style.background = 'rgba(255, 255, 255, 0.015)';
                row.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                row.style.borderRadius = '14px';
                row.style.padding = '16px';
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.flexWrap = 'wrap';
                row.style.gap = '15px';

                const reqDate = new Date(loan.dataSolicitacao).toLocaleDateString('pt-BR');

                row.innerHTML = `
                    <div style="flex: 1; min-width: 250px;">
                        <h4 style="font-size: 1rem; color: #fff; margin: 0; font-weight: 700;">${loan.tituloLivro}</h4>
                        <div style="margin-top: 6px; font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                            <span>👤 Aluno: <strong style="color: #fff">${loan.nome}</strong> (${loan.email})</span>
                            <span>📍 Localização Física: <strong style="color: var(--accent)">${locationStr}</strong></span>
                            <span>📅 Solicitado em: ${reqDate}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn-confirm-pickup" data-loan-id="${loan.id}" style="padding: 10px 16px; font-size: 0.8rem; background: var(--primary); border-radius: 8px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.1);">
                            Confirmar Retirada
                        </button>
                        <button class="btn-cancel-pickup" data-loan-id="${loan.id}" style="padding: 10px 16px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Recusar/Cancelar
                        </button>
                    </div>
                `;

                pendingContainer.appendChild(row);
            });
        }
    }

    if (activeLoansBody) {
        activeLoansBody.innerHTML = '';
        const activeLoans = loans.filter(l => {
            const matchesQuery = l.tituloLivro.toLowerCase().includes(query) || 
                                 l.nome.toLowerCase().includes(query) || 
                                 l.email.toLowerCase().includes(query);
            return (l.status === 'Ativo' || l.status === 'Atrasado') && matchesQuery;
        });

        if (activeLoans.length === 0) {
            activeLoansBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px 0;">Nenhum empréstimo ativo correspondente.</td></tr>';
        } else {
            activeLoans.forEach(loan => {
                const tr = document.createElement('tr');
                tr.style.background = 'rgba(255, 255, 255, 0.01)';

                const pickupDate = loan.dataRetirada ? new Date(loan.dataRetirada).toLocaleDateString('pt-BR') : '-';
                const dueDate = loan.dataDevolucaoPrevista ? new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR') : '-';

                let statusBadge = '';
                if (loan.status === 'Atrasado') {
                    statusBadge = `<span class="badge-loan badge-loan-overdue">Atrasado</span>`;
                } else {
                    statusBadge = `<span class="badge-loan badge-loan-active">Ativo</span>`;
                }

                tr.innerHTML = `
                    <td data-label="Livro" style="font-weight:600; color:#fff;">${loan.tituloLivro}</td>
                    <td data-label="Médium">${loan.nome}</td>
                    <td data-label="E-mail">${loan.email}</td>
                    <td data-label="Data Retirada">${pickupDate}</td>
                    <td data-label="Prazo Limite" style="font-weight:600; color:${loan.status === 'Atrasado' ? '#f87171' : '#fff'}">${dueDate}</td>
                    <td data-label="Status">${statusBadge}</td>
                    <td data-label="Ações" style="text-align: center;">
                        <button class="btn-confirm-return" data-loan-id="${loan.id}" style="padding: 8px 12px; font-size: 0.75rem; background: var(--success); border-radius: 8px; font-weight: 600; cursor: pointer; border: none; color: #fff;">
                            Devolvido ✓
                        </button>
                    </td>
                `;

                activeLoansBody.appendChild(tr);
            });
        }
    }

    document.querySelectorAll('.btn-confirm-pickup').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            if (confirm("Confirma que o médium está retirando o livro físico e deseja ativar o empréstimo de 15 dias?")) {
                btn.disabled = true;
                btn.innerText = 'Ativando...';
                await confirmPickup(loanId);
            }
        });
    });

    document.querySelectorAll('.btn-cancel-pickup').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            if (confirm("Deseja realmente recusar e cancelar esta solicitação? O livro voltará ao estoque.")) {
                btn.disabled = true;
                btn.innerText = 'Cancelando...';
                await cancelPickup(loanId);
            }
        });
    });

    document.querySelectorAll('.btn-confirm-return').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            if (confirm("Confirma que o livro foi devolvido fisicamente ao terreiro?")) {
                btn.disabled = true;
                btn.innerText = 'Processando...';
                await confirmReturn(loanId);
            }
        });
    });
}

function renderLibBooks(filterQuery = '') {
    const booksTableBody = document.getElementById('lib-books-table-body');
    if (!booksTableBody || !window.adminLibraryData) return;

    booksTableBody.innerHTML = '';
    const query = filterQuery.toLowerCase().trim();
    const books = window.adminLibraryData.books.filter(b => {
        return b.titulo.toLowerCase().includes(query) || b.autor.toLowerCase().includes(query);
    });

    if (books.length === 0) {
        booksTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px 0;">Nenhum livro cadastrado correspondente.</td></tr>';
        return;
    }

    books.forEach(book => {
        const tr = document.createElement('tr');
        tr.style.background = 'rgba(255, 255, 255, 0.01)';

        let coverCell = '';
        if (book.capaUrl && book.capaUrl.startsWith('http')) {
            coverCell = `<img src="${book.capaUrl}" style="width: 40px; height: 55px; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        } else {
            coverCell = `
                <div class="book-cover-css" style="width: 35px; height: 50px; border-radius: 2px 5px 5px 2px; padding: 2px; overflow: hidden; border-left: 2px solid rgba(0,0,0,0.25); background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);">
                    <div style="font-size: 0.35rem; font-weight: 700; color: #fff; text-align: center; line-height: 1.1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 3px; font-family: sans-serif;">${book.titulo}</div>
                </div>
            `;
        }

        tr.innerHTML = `
            <td data-label="Capa" style="width: 60px;">${coverCell}</td>
            <td data-label="Título" style="font-weight:600; color:#fff;">${book.titulo}</td>
            <td data-label="Autor">${book.autor || 'Não informado'}</td>
            <td data-label="Categoria" style="text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">${book.categoria || 'Geral'}</td>
            <td data-label="Localização Física">${book.localizacao || 'Não cadastrada'}</td>
            <td data-label="Qtd Total" style="text-align: center; font-weight: 500;">${book.qtdTotal}</td>
            <td data-label="Disponível" style="text-align: center; font-weight: 700; color:${book.qtdDisponivel > 0 ? '#34d399' : '#f87171'}">${book.qtdDisponivel}</td>
            <td data-label="Ações" style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button class="btn-edit-book" data-id="${book.id}" style="padding: 6px 12px; font-size: 0.75rem; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: var(--accent); border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Editar
                    </button>
                    <button class="btn-delete-book" data-id="${book.id}" style="padding: 6px 12px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Excluir
                    </button>
                </div>
            </td>
        `;

        booksTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit-book').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const book = window.adminLibraryData.books.find(b => b.id === id);
            if (book) {
                document.getElementById('book-modal-title').innerText = "Editar Livro";
                document.getElementById('book-form-id').value = book.id;
                document.getElementById('book-form-title').value = book.titulo;
                document.getElementById('book-form-author').value = book.autor || '';
                document.getElementById('book-form-synopsis').value = book.sinopse || '';
                document.getElementById('book-form-cover').value = book.capaUrl || '';
                document.getElementById('book-form-category').value = book.categoria || 'Geral';
                document.getElementById('book-form-location').value = book.localizacao || '';
                document.getElementById('book-form-qty').value = book.qtdTotal;
                document.getElementById('book-form-feedback').innerHTML = "";
                openModalById('book-editor-modal');
            }
        });
    });

    document.querySelectorAll('.btn-delete-book').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("Deseja realmente excluir este livro do acervo? Os empréstimos vinculados continuarão registrados, mas o livro sairá da vitrine.")) {
                btn.disabled = true;
                btn.innerText = 'Excluindo...';
                await deleteBook(id);
            }
        });
    });
}

async function saveBookForm() {
    const id = document.getElementById('book-form-id').value;
    const titulo = document.getElementById('book-form-title').value.trim();
    const autor = document.getElementById('book-form-author').value.trim();
    const sinopse = document.getElementById('book-form-synopsis').value.trim();
    const capaUrl = document.getElementById('book-form-cover').value.trim();
    const categoria = document.getElementById('book-form-category').value.trim() || 'Geral';
    const localizacao = document.getElementById('book-form-location').value.trim();
    const qtdTotal = parseInt(document.getElementById('book-form-qty').value.trim()) || 1;
    const feedback = document.getElementById('book-form-feedback');

    if (!titulo || !localizacao) {
        feedback.innerHTML = '<span style="color: #ef4444">Título e Localização Física são obrigatórios.</span>';
        return;
    }

    const btn = document.getElementById('btn-save-book');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Gravando...';
    feedback.innerHTML = '';

    try {
        const res = await apiFetch('saveBook', {
            method: 'POST',
            data: {
                id: id || null,
                titulo,
                autor,
                sinopse,
                capaUrl,
                categoria,
                localizacao,
                qtdTotal,
                adminEmail: window.currentUserEmail
            }
        });

        if (res.status === 'success') {
            feedback.innerHTML = `<span style="color: var(--success)">${res.message}</span>`;
            setTimeout(() => {
                closeModalById('book-editor-modal');
                carregarBiblioteca();
            }, 1500);
        } else {
            feedback.innerHTML = `<span style="color: #ef4444">Erro: ${res.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (err) {
        feedback.innerHTML = '<span style="color: #ef4444">Erro na conexão com o servidor.</span>';
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function deleteBook(id) {
    try {
        const res = await apiFetch('deleteBook', {
            method: 'POST',
            data: {
                id,
                adminEmail: window.currentUserEmail
            }
        });

        if (res.status === 'success') {
            alert(res.message);
            carregarBiblioteca();
        } else {
            alert("Erro: " + res.message);
            carregarBiblioteca();
        }
    } catch (err) {
        alert("Erro na conexão com o servidor.");
        carregarBiblioteca();
    }
}

async function confirmPickup(loanId) {
    try {
        const res = await apiFetch('confirmBookPickup', {
            method: 'POST',
            data: {
                loanId,
                adminEmail: window.currentUserEmail
            }
        });

        if (res.status === 'success') {
            alert(res.message);
            carregarBiblioteca();
        } else {
            alert("Erro: " + res.message);
            carregarBiblioteca();
        }
    } catch (err) {
        alert("Erro ao conectar com o servidor.");
        carregarBiblioteca();
    }
}

async function cancelPickup(loanId) {
    try {
        const res = await apiFetch('cancelBookLoanRequest', {
            method: 'POST',
            data: { loanId }
        });

        if (res.status === 'success') {
            alert("Solicitação cancelada com sucesso!");
            carregarBiblioteca();
        } else {
            alert("Erro: " + res.message);
            carregarBiblioteca();
        }
    } catch (err) {
        alert("Erro ao conectar com o servidor.");
        carregarBiblioteca();
    }
}

async function confirmReturn(loanId) {
    try {
        const res = await apiFetch('confirmBookReturn', {
            method: 'POST',
            data: {
                loanId,
                adminEmail: window.currentUserEmail
            }
        });

        if (res.status === 'success') {
            alert(res.message);
            carregarBiblioteca();
        } else {
            alert("Erro: " + res.message);
            carregarBiblioteca();
        }
    } catch (err) {
        alert("Erro ao conectar com o servidor.");
        carregarBiblioteca();
    }
}

window.carregarBiblioteca = carregarBiblioteca;
window.renderLibLoans = renderLibLoans;
window.renderLibBooks = renderLibBooks;
