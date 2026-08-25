import { getAreaClass, getBadgeClass, openModalById, closeModalById, renderGenericHistory, apiFetch } from './utils.js';

export async function renderStudentDashboard(email, targetContainerId = 'app') {
    const app = document.getElementById(targetContainerId);
    if (!app) return;

    // HTML Base do Aluno
    app.innerHTML = `
        <div class="dashboard-grid">
            <!-- Coluna Esquerda: Perfil e Logout -->
            <div class="user-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow); display: flex; flex-direction: column; gap: 24px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--primary), var(--accent));"></div>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1; min-width: 200px;">
                        <div id="user-info-skeleton">
                            <div class="skeleton skeleton-text" style="width: 80%; height: 2.2rem; margin-bottom: 12px;"></div>
                            <div class="skeleton skeleton-text" style="width: 60%; height: 1.2rem;"></div>
                        </div>

                        <div id="user-info-content" style="display: none;">
                            <h2 id="user-name" style="margin: 0; font-size: 1.8rem; font-weight: 800; line-height: 1.1; color: #fff; letter-spacing: -0.03em;"></h2>
                            <div id="user-email-display" style="color: var(--text-muted); font-size: 0.9rem; margin-top: 8px; word-break: break-word; overflow-wrap: anywhere; font-weight: 400;"></div>
                            <div id="user-courses" class="badges-container" style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px;"></div>
                        </div>
                    </div>

                    ${targetContainerId === 'app' ? `<button id="btn-logout" class="btn-logout" style="padding: 10px 18px; background: rgba(239, 68, 68, 0.08); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.05em;">Sair</button>` : ''}
                </div>

                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>

                <button id="btn-enable-push" style="width: 100%; padding: 14px; background: rgba(99, 102, 241, 0.1); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: var(--glow-shadow);">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/></svg>
                    Ativar Notificações
                </button>

                <div id="next-ritual-badge" style="background: rgba(124, 58, 237, 0.1); color: #ddd6fe; padding: 16px 20px; border-radius: 16px; font-size: 0.95rem; border: 1px solid rgba(124, 58, 237, 0.2); font-weight: 500; display: flex; flex-direction: column; gap: 4px;">
                    <span id="next-ritual-label" style="display: block; font-size: 0.7rem; color: #a78bfa; letter-spacing: 0.1em; font-weight: 700; text-transform: uppercase;">PRÓXIMO RITUAL EM</span>
                    <span id="next-ritual-timer" style="color: #fff; font-weight: 700; font-size: 1.1rem;">Calculando...</span>
                </div>
            </div>

            <!-- Coluna Direita: Conteúdo Principal -->
            <div class="main-content-area" style="display: flex; flex-direction: column; gap: 30px;">
                
                <!-- Sistema de Presença -->
                ${targetContainerId === 'app' ? `
                <div class="presence-card animate-fade-in" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow); position: relative;">
                    <h3 style="margin-top: 0; margin-bottom: 24px; font-weight: 700; font-size: 1.3rem; color: #fff; letter-spacing: -0.02em;">Presença no Terreiro</h3>
                    <button id="btn-self-presence" style="width: 100%; padding: 18px; font-size: 1.1rem; border-radius: 16px; display: flex; justify-content: center; align-items: center; gap: 12px;">
                        <span>📍</span> Confirmar Minha Presença
                    </button>
                    <div id="gps-status" style="margin-top: 20px; font-size: 0.9rem; color: var(--text-muted); text-align: center; font-weight: 400;">
                        <span id="gps-msg" style="display: flex; align-items: center; justify-content: center; gap: 8px;">Aguardando autorização</span>
                    </div>
                </div>
                ` : ''}

                <!-- Controle Financeiro / Mensalidades -->
                <div id="payment-card-container"></div>

                <!-- Cursos TUIG -->
                <div id="courses-card-container"></div>

                <!-- Biblioteca -->
                <div id="library-card-container"></div>


                <!-- Histórico e Rituais -->
                <section class="animate-fade-in">
                    <div id="rituals-list">
                        <div class="loader active"></div>
                    </div>
                </section>

            </div>
        </div>
    `;

    // Injeta Modal (se não existir)
    let modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) {
        modalsContainer = document.createElement('div');
        modalsContainer.id = 'modals-container';
        document.body.appendChild(modalsContainer);
    }

    // Remove existing modals if they exist to avoid event listener accumulation on DOM elements that persist
    const oldHistoryModal = document.getElementById('history-modal');
    if (oldHistoryModal) oldHistoryModal.remove();

    const oldJustificationModal = document.getElementById('justification-modal');
    if (oldJustificationModal) oldJustificationModal.remove();

    const oldUploadReceiptModal = document.getElementById('upload-receipt-modal');
    if (oldUploadReceiptModal) oldUploadReceiptModal.remove();

    const oldLibraryModal = document.getElementById('library-modal');
    if (oldLibraryModal) oldLibraryModal.remove();

    if (!document.getElementById('history-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="history-modal" class="modal">
                <div class="modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Meu Histórico</h2>
                        <span id="close-history-modal" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 16px; margin-bottom: 32px;">
                        <select id="filter-year" style="padding: 14px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; font-size: 0.9rem; outline: none; transition: all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                            <option value="all">Anos</option>
                            <option value="2026">2026</option>
                        </select>
                        <select id="filter-month" style="padding: 14px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; font-size: 0.9rem; outline: none; transition: all 0.3s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
                            <option value="all">Meses</option>
                        </select>
                    </div>

                    <div id="modal-history-list" style="overflow-y: auto; max-height: 50vh; padding-right: 5px; display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('justification-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="justification-modal" class="modal">
                <div class="modal-content">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Justificar Falta</h2>
                        <span id="close-justification-modal" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>

                    <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5; margin-bottom: 24px;">
                        Sua justificativa será avaliada. Caso seja aceita, sua falta constará como abonada.
                    </p>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; color:#fff; font-size:0.9rem;">Motivo da ausência:</label>
                        <textarea id="justification-text" rows="4" style="width: 100%; padding: 16px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; font-size: 1rem; outline: none; transition: all 0.3s; resize: vertical;" placeholder="Explique resumidamente o motivo da falta..." onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'"></textarea>
                    </div>

                    <button id="btn-submit-justification" style="width: 100%; padding: 16px; font-size: 1.1rem; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 12px; background: var(--primary); color: #fff; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s;">
                        Enviar Justificativa
                    </button>
                    <div id="justification-feedback" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('upload-receipt-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="upload-receipt-modal" class="modal">
                <div class="modal-content" style="max-width: 450px; width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h2 style="margin:0; font-size:1.5rem; font-weight:800; letter-spacing:-0.03em;">Enviar Comprovante</h2>
                        <span id="close-upload-receipt-modal" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1;">&times;</span>
                    </div>

                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 20px;">
                        Selecione o arquivo do comprovante para o mês de <strong id="upload-receipt-month" style="color:var(--accent)"></strong>.
                    </p>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; color:#fff; font-size:0.9rem;">Arquivo (Imagem ou PDF):</label>
                        <input type="file" id="receipt-file-input" accept="image/*,application/pdf" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; font-size: 0.9rem; outline: none;">
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom: 8px; color:#fff; font-size:0.9rem;">Observações (Opcional):</label>
                        <textarea id="receipt-obs-input" rows="3" placeholder="Ex: Pagando dois meses juntos, ou observação do pagamento..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 8px; font-size: 0.9rem; outline: none; resize: vertical;"></textarea>
                    </div>

                    <button id="btn-submit-receipt" style="width: 100%; padding: 14px; font-size: 1rem; border-radius: 10px; display: flex; justify-content: center; align-items: center; gap: 8px; background: var(--primary); color: #fff; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s;">
                        Enviar Comprovante
                    </button>
                    <div id="upload-receipt-feedback" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('library-modal')) {
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="library-modal" class="modal">
                <div class="modal-content" style="max-width: 900px; width: 95%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h2 style="margin:0; font-size:1.6rem; font-weight:800; letter-spacing:-0.03em;">Vitrine de Livros</h2>
                        <span id="close-library-modal" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1; cursor:pointer;">&times;</span>
                    </div>
                    
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 20px;">
                        Explore o acervo do terreiro. Você terá <strong>15 dias</strong> para ler e devolver o livro ao terreiro. Após solicitar, confirme a retirada com um administrador físico.
                    </p>
                    
                    <div style="position: relative; margin-bottom: 16px;">
                        <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size:1rem; opacity:0.6;">🔍</span>
                        <input type="text" id="library-search-input" placeholder="Buscar por título ou autor..." style="padding: 12px 12px 12px 40px; border-radius: 12px; margin-bottom: 0; box-sizing: border-box;">
                    </div>

                    <div id="library-categories-container" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 20px; scrollbar-width: none; -ms-overflow-style: none;">
                        <!-- Injetado dinamicamente via JS -->
                    </div>
                    
                    <div id="library-books-list" class="books-grid">
                        <!-- Injetado via Javascript -->
                    </div>
                </div>
            </div>
        `);
    }

    // Bind events
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout && targetContainerId === 'app') {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('tuig_email');
            window.location.reload();
        });
    }

    const btnPresenceInit = document.getElementById('btn-self-presence');
    if (btnPresenceInit) {
        btnPresenceInit.addEventListener('click', () => markSelfPresence(email));
    }

    const btnPush = document.getElementById('btn-enable-push');
    if (btnPush) {
        btnPush.addEventListener('click', () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

            // iOS no navegador (não instalado como PWA) → Tutorial de instalação
            if (isIOS && !isStandalone) {
                showInstallTutorialModal();
                return;
            }

            // PWA instalado ou Desktop/Android → OneSignal normal
            if (window.OneSignalDeferred) {
                window.OneSignalDeferred.push(async function (OneSignal) {
                    try {
                        await OneSignal.Slidedown.promptPush();
                        btnPush.innerHTML = "✓ Notificações Ativadas!";
                        btnPush.style.color = "#10b981";
                        btnPush.style.background = "rgba(16, 185, 129, 0.1)";
                        btnPush.style.borderColor = "rgba(16, 185, 129, 0.3)";
                    } catch (pushErr) {
                        alert("Não foi possível abrir o prompt. Verifique se o navegador está bloqueando notificações nas configurações do celular.");
                        console.error("OneSignal Prompt Error:", pushErr);
                    }
                });
            } else {
                alert("O sistema de notificações ainda está carregando ou foi bloqueado por algum Adblock/Navegador.");
            }
        });
    }

    document.getElementById('close-history-modal').addEventListener('click', () => {
        closeModalById('history-modal');
    });

    document.getElementById('close-justification-modal').addEventListener('click', () => {
        closeModalById('justification-modal');
    });

    document.getElementById('close-upload-receipt-modal').addEventListener('click', () => {
        closeModalById('upload-receipt-modal');
    });

    const closeLibBtn = document.getElementById('close-library-modal');
    if (closeLibBtn) {
        closeLibBtn.addEventListener('click', () => {
            closeModalById('library-modal');
        });
    }

    const searchLibInput = document.getElementById('library-search-input');
    if (searchLibInput) {
        searchLibInput.addEventListener('keyup', (e) => {
            renderBooksShowcase(e.target.value);
        });
    }

    document.getElementById('btn-submit-receipt').addEventListener('click', async () => {
        const fileInput = document.getElementById('receipt-file-input');
        const feedback = document.getElementById('upload-receipt-feedback');
        const obsInput = document.getElementById('receipt-obs-input');

        if (!fileInput.files || fileInput.files.length === 0) {
            feedback.innerHTML = '<span style="color:var(--danger)">Selecione um arquivo.</span>';
            return;
        }

        const file = fileInput.files[0];
        if (file.size > 4 * 1024 * 1024) {
            feedback.innerHTML = '<span style="color:var(--danger)">Arquivo muito grande (máximo 4MB).</span>';
            return;
        }

        const btn = document.getElementById('btn-submit-receipt');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span style="font-size: 0.9rem; opacity: 0.8;">Enviando...</span>';
        btn.disabled = true;

        const reader = new FileReader();
        reader.onload = async function (e) {
            const base64Data = e.target.result;
            try {
                const userName = document.getElementById('user-name').innerText;
                const json = await apiFetch('uploadReceipt', {
                    method: 'POST',
                    data: {
                        email: email,
                        nome: userName,
                        mes: window.currentUploadMonth,
                        ano: new Date().getFullYear(),
                        fileBase64: base64Data,
                        fileName: file.name,
                        mimeType: file.type,
                        obs: obsInput ? obsInput.value.trim() : ""
                    }
                });

                if (json.status === 'success') {
                    feedback.innerHTML = '<span style="color:var(--success)">Comprovante enviado com sucesso!</span>';
                    setTimeout(() => {
                        closeModalById('upload-receipt-modal');
                        renderStudentDashboard(email, targetContainerId);
                    }, 2000);
                } else {
                    feedback.innerHTML = `<span style="color:var(--danger)">Erro: ${json.message}</span>`;
                }
            } catch (err) {
                feedback.innerHTML = '<span style="color:var(--danger)">Erro ao conectar com o servidor.</span>';
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-submit-justification').addEventListener('click', async () => {
        const text = document.getElementById('justification-text').value.trim();
        const feedback = document.getElementById('justification-feedback');

        if (!text) {
            feedback.innerHTML = '<span style="color:var(--danger)">Por favor, preencha o motivo.</span>';
            return;
        }

        const btn = document.getElementById('btn-submit-justification');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span style="font-size: 0.9rem; opacity: 0.8;">Enviando...</span>';
        btn.disabled = true;

        try {
            const userName = document.getElementById('user-name').innerText;
            const json = await apiFetch('sendJustification', {
                method: 'POST',
                data: {
                    email: email,
                    nome: userName,
                    motivo: text,
                    dataEvento: window.currentJustificationDate
                }
            });

            if (json.status === 'success') {
                feedback.innerHTML = '<span style="color:var(--success)">Justificativa enviada com sucesso!</span>';
                document.getElementById('justification-text').value = '';
                setTimeout(() => closeModalById('justification-modal'), 2500);
            } else {
                feedback.innerHTML = `<span style="color:var(--danger)">Erro: ${json.message}</span>`;
            }
        } catch (e) {
            feedback.innerHTML = '<span style="color:var(--danger)">Erro na conexão com o servidor.</span>';
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Função de filtro atrelada ao window para o modal
    window.filterHistory = function () {
        renderGenericHistory({
            listId: 'modal-history-list',
            data: window.userEventHistory,
            yearFilterId: 'filter-year',
            monthFilterId: 'filter-month'
        });
    }

    document.getElementById('filter-year').addEventListener('change', window.filterHistory);
    document.getElementById('filter-month').addEventListener('change', window.filterHistory);

    // Fetch Data
    try {
        const json = await apiFetch('getUserData', { params: { email } });

        if (json.status === "success") {
            showUserData(json.data);
            renderStudentCourses(email);
            renderStudentLibrary(email);
        } else {
            showError(json.message);
        }
    } catch (e) {
        showError("Erro de conexão com o servidor.");
    }
}

function showUserData(data) {
    const listDiv = document.getElementById('rituals-list');
    const skeleton = document.getElementById('user-info-skeleton');
    const content = document.getElementById('user-info-content');

    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'block';

    if (!data || !data.user) {
        listDiv.innerHTML = '<p style="text-align: center; margin-top: 20px;">Dados não encontrados.</p>';
        return;
    }

    document.getElementById('user-name').innerText = data.user.nome;
    document.getElementById('user-email-display').innerText = data.user.email;

    const ritualBadge = document.getElementById('next-ritual-badge');
    const ritualLabel = document.getElementById('next-ritual-label');
    const ritualTimer = document.getElementById('next-ritual-timer');

    if (ritualBadge && ritualLabel && ritualTimer) {
        const pr = data.proximoRitual;
        if (pr) {
            if (pr.status === 'eligible') {
                ritualBadge.style.background = 'rgba(16, 185, 129, 0.08)';
                ritualBadge.style.border = '1px solid rgba(16, 185, 129, 0.2)';
                ritualLabel.style.color = '#34d399';
                ritualLabel.innerText = `PRÓXIMO RITUAL: ${pr.nome.toUpperCase()}`;
                ritualTimer.innerText = pr.tempoFormatado || 'Hoje';
                ritualTimer.style.color = '#ffffff';
            } else {
                ritualBadge.style.background = 'rgba(239, 68, 68, 0.08)';
                ritualBadge.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                ritualLabel.style.color = '#f87171';
                ritualLabel.innerText = `RECOMENDADO: ${pr.nome.toUpperCase()}`;
                ritualTimer.innerText = `🚫 ${pr.mensagem}`;
                ritualTimer.style.color = '#fca5a5';
            }
        } else {
            ritualBadge.style.background = 'rgba(255, 255, 255, 0.03)';
            ritualBadge.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            ritualLabel.style.color = '#a1a1aa';
            ritualLabel.innerText = 'RITUAL RECOMENDADO';
            ritualTimer.innerText = 'Nenhum ritual agendado';
            ritualTimer.style.color = '#ffffff';
        }
    }

    const coursesDiv = document.getElementById('user-courses');
    if (coursesDiv && data.user.cursos) {
        coursesDiv.innerHTML = '';
        data.user.cursos.forEach(curso => {
            const badge = document.createElement('span');
            badge.className = 'badge ' + getBadgeClass(curso);
            badge.innerText = curso;
            coursesDiv.appendChild(badge);
        });
    }

    const btnPresence = document.getElementById('btn-self-presence');
    if (btnPresence) {
        if (data.presenceToday) {
            btnPresence.innerText = "✅ Presença já confirmada hoje!";
            btnPresence.disabled = true;
            btnPresence.style.background = "rgba(16, 185, 129, 0.2)";
            btnPresence.style.color = "#10b981";
        } else if (!data.canMarkPresence) {
            btnPresence.innerHTML = `🔒 Indisponível`;
            btnPresence.disabled = true;
            btnPresence.style.opacity = "0.5";
            const gpsMsg = document.getElementById('gps-msg');
            if (gpsMsg) gpsMsg.innerText = data.blockReason || "Hoje não é dia de rito da sua turma.";
        }
    }

    // Renderizar painel financeiro (Mensalidades)
    const paymentContainer = document.getElementById('payment-card-container');
    if (paymentContainer) {
        paymentContainer.innerHTML = '';

        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const currentYear = new Date().getFullYear();

        const payCard = document.createElement('div');
        payCard.className = 'presence-card animate-fade-in';
        payCard.style.background = 'var(--glass-bg)';
        payCard.style.padding = '24px';
        payCard.style.borderRadius = '20px';
        payCard.style.border = '1px solid var(--glass-border)';
        payCard.style.boxShadow = 'var(--premium-shadow)';
        payCard.style.marginBottom = '20px';
        payCard.style.position = 'relative';

        let gridHtml = '';
        meses.forEach(m => {
            const payInfo = data.payments ? data.payments[m] : null;
            let status = "Em Aberto";
            let link = "";
            let obsAluno = "";
            let obsAdmin = "";

            if (payInfo) {
                status = payInfo.status;
                link = payInfo.link;
                obsAluno = payInfo.obsAluno;
                obsAdmin = payInfo.obsAdmin;
            }

            let badgeColor = "#ef4444"; // Aberto (Red)
            let badgeText = "Em Aberto";
            let actionBtn = "";

            if (status === "Aprovado" || status === "Pago") {
                badgeColor = "#10b981"; // Pago (Green)
                badgeText = "Pago";
                if (link) {
                    actionBtn = `<a href="${link}" target="_blank" style="font-size:0.75rem; color:var(--accent); text-decoration:none; margin-top:8px; display:inline-block; font-weight:500;">📎 Ver Recibo</a>`;
                }
            } else if (status === "Pendente") {
                badgeColor = "#f59e0b"; // Pendente (Orange)
                badgeText = "Pendente";
                if (link) {
                    actionBtn = `<a href="${link}" target="_blank" style="font-size:0.75rem; color:var(--accent); text-decoration:none; margin-top:8px; display:inline-block; font-weight:500;">📎 Ver Recibo</a>`;
                }
            } else if (status === "Rejeitado") {
                badgeColor = "#ef4444"; // Rejeitado (Red)
                badgeText = "Recusado";
                actionBtn = `
                    <button class="btn-upload-receipt-trigger" data-month="${m}" style="margin-top:8px; padding:6px 10px; font-size:0.75rem; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2); color:#fff; border-radius:8px; cursor:pointer; font-weight:600; width:100%; transition:all 0.2s;">
                        Reenviar 📎
                    </button>
                    ${obsAdmin ? `<div style="font-size:0.7rem; color:#ef4444; margin-top:6px; font-style:italic; line-height:1.2; word-break:break-word;">Motivo: ${obsAdmin}</div>` : ''}
                `;
            } else {
                actionBtn = `
                    <button class="btn-upload-receipt-trigger" data-month="${m}" style="margin-top:8px; padding:6px 10px; font-size:0.75rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:8px; cursor:pointer; font-weight:600; width:100%; transition:all 0.2s;">
                        Anexar 📎
                    </button>
                `;
            }

            gridHtml += `
                <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; text-align:center; min-height:110px;">
                    <span style="font-weight:700; color:#fff; font-size:0.85rem;">${m}</span>
                    <span class="badge" style="background:${badgeColor}15; color:${badgeColor}; border:1px solid ${badgeColor}30; font-size:0.6rem; padding:2px 6px; border-radius:4px; margin-top:6px; text-transform:uppercase;">
                        ${badgeText}
                    </span>
                    ${actionBtn}
                </div>
            `;
        });

        payCard.innerHTML = `
            <h3 style="margin-top:0; margin-bottom:6px; font-weight:700; font-size:1.2rem; color:#fff; letter-spacing:-0.02em;">Mensalidades de ${currentYear}</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px;">Acompanhe o status e envie comprovantes para a administração.</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:10px;">
                ${gridHtml}
            </div>
        `;
        paymentContainer.appendChild(payCard);

        // Bind upload triggers
        document.querySelectorAll('.btn-upload-receipt-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const m = e.currentTarget.getAttribute('data-month');
                window.currentUploadMonth = m;
                document.getElementById('upload-receipt-month').innerText = m;
                const feedback = document.getElementById('upload-receipt-feedback');
                if (feedback) feedback.innerHTML = '';
                const fileInput = document.getElementById('receipt-file-input');
                if (fileInput) fileInput.value = '';
                const obsInput = document.getElementById('receipt-obs-input');
                if (obsInput) obsInput.value = '';
                openModalById('upload-receipt-modal');
            });
        });
    }

    listDiv.innerHTML = '';

    if (data.frequencyStats && data.frequencyStats.total > 0) {
        window.userEventHistory = data.eventHistory;

        const freqDiv = document.createElement('div');
        freqDiv.className = 'ritual-card';
        freqDiv.style.background = 'rgba(16, 185, 129, 0.05)';
        freqDiv.style.border = '1px solid rgba(16, 185, 129, 0.2)';
        freqDiv.style.display = 'block';
        freqDiv.style.padding = '24px';

        freqDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 20px; margin-bottom:15px;">
                <h3 style="margin:0; font-size:1.2rem; color:#fff; font-weight: 600;">Minha Frequência</h3>
                <div style="text-align: right;">
                    <span class="badge" style="background:${data.frequencyStats.percentage >= 70 ? '#10b981' : '#f59e0b'}; padding: 8px 12px; font-size: 0.9rem; display: inline-block;">
                        ${data.frequencyStats.percentage}% Assiduidade
                    </span>
                </div>
            </div>
            
            <p style="color:var(--text-muted); font-size:0.95rem; line-height: 1.5; margin-bottom: 20px;">
                Você compareceu a <strong style="color:#fff; font-size: 1rem;">${data.frequencyStats.present}</strong> de <strong style="color:#fff; font-size: 1rem;">${data.frequencyStats.total}</strong> eventos.
            </p>

            <button id="btn-open-history" style="width:100%; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; cursor:pointer; font-size:0.9rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>📅</span> Ver Histórico Completo
            </button>
        `;
        listDiv.appendChild(freqDiv);

        document.getElementById('btn-open-history').addEventListener('click', () => {
            openModalById('history-modal', window.filterHistory, window.userEventHistory, 'filter-month');
        });
    }

    if (!data.rituals || data.rituals.length === 0) {
        if (!data.frequencyStats || data.frequencyStats.total === 0) {
            listDiv.innerHTML += '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Nenhum registro encontrado.</p>';
        }
        return;
    }

    const title = document.createElement('h3');
    title.innerText = "Rituais realizados";
    title.style.marginTop = "30px";
    title.style.marginBottom = "15px";
    title.style.fontSize = "1rem";
    title.style.color = "var(--text-muted)";
    title.style.textAlign = "center";
    listDiv.appendChild(title);

    data.rituals.forEach(r => {
        const card = document.createElement('div');
        card.className = 'ritual-card ' + getAreaClass(r.nome);
        const date = new Date(r.data).toLocaleDateString('pt-BR');

        card.innerHTML = `
            <div style="flex: 1;">
                <strong style="font-size: 1rem; color: #fff;">${r.nome}</strong><br>
                <small style="color: var(--text-muted); display: block; margin-top: 4px;">${date}</small>
                ${r.notas ? `<p style="margin-top: 12px; font-size: 0.85rem; color: #cbd5e1; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; border-left: 3px solid var(--primary);">${r.notas}</p>` : ''}
            </div>
            <div class="intervalo">${r.intervalo}</div>
        `;
        listDiv.appendChild(card);
    });
}

function showError(err) {
    const listDiv = document.getElementById('rituals-list');
    if (listDiv) {
        listDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">${err}</p>`;
    }
}

function getDeviceId() {
    let id = localStorage.getItem('tuig_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('tuig_device_id', id);
    }
    return id;
}

function markSelfPresence(email) {
    const btn = document.getElementById('btn-self-presence');
    const msg = document.getElementById('gps-msg');

    btn.disabled = true;
    msg.innerText = "Obtendo localização...";

    if (!navigator.geolocation) {
        showPresenceError("GPS não suportado neste aparelho.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const data = {
                action: 'registerPresence',
                data: {
                    studentEmail: email,
                    registeredBy: email,
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    deviceId: getDeviceId()
                }
            };

            try {
                const res = await apiFetch('registerPresence', {
                    method: 'POST',
                    data: data.data
                });

                if (res.status === "success") {
                    btn.innerHTML = "✅ Presença Confirmada!";
                    msg.innerText = res.message;
                    msg.style.color = res.withinRadius ? "#10b981" : "#ef4444";
                } else {
                    showPresenceError(res.message);
                }
            } catch (error) {
                showPresenceError("Erro de conexão com o servidor.");
            }
        },
        (err) => {
            console.error("Erro GPS:", err);
            let errMsg = "Erro ao acessar GPS. Verifique as permissões.";
            if (err.code === 1) errMsg = "Permissão de GPS negada pelo celular/navegador. Vá nas configurações do site e permita a Localização.";
            else if (err.code === 2) errMsg = "Sinal de GPS indisponível no momento.";
            else if (err.code === 3) errMsg = "Tempo esgotado ao buscar GPS (demorou muito).";

            showPresenceError(errMsg);
            alert(errMsg); // Força um alerta na tela do celular para o usuário não ficar cego
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
}

function showPresenceError(errorText) {
    const btn = document.getElementById('btn-self-presence');
    const msg = document.getElementById('gps-msg');
    btn.disabled = false;
    msg.style.color = "#ef4444";
    msg.innerText = errorText;
}

function showInstallTutorialModal() {
    // Detecta se é Safari ou outro navegador iOS (Chrome, etc.)
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
    const appUrl = window.location.href;

    const steps = `
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:18px;">
            <div style="min-width:32px; height:32px; background:#3b82f6; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem;">1</div>
            <div>
                <strong style="color:#fff;">Toque no ícone de Compartilhar ou no Menu</strong>
                <p style="color:#94a3b8; margin:4px 0 0; font-size:0.85rem;">Procure pelo ícone <span style="font-size:1.2rem;">⬆</span> ou pelos <span style="font-size:1.2rem;">...</span> no seu navegador.</p>
            </div>
        </div>
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:18px;">
            <div style="min-width:32px; height:32px; background:#3b82f6; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem;">2</div>
            <div>
                <strong style="color:#fff;">Toque em "Adicionar à Tela de Início"</strong>
                <p style="color:#94a3b8; margin:4px 0 0; font-size:0.85rem;">Role as opções até encontrar o ícone ➕ com este nome.</p>
            </div>
        </div>
        <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="min-width:32px; height:32px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem;">3</div>
            <div>
                <strong style="color:#fff;">Abra o app pelo novo ícone na tela inicial</strong>
                <p style="color:#94a3b8; margin:4px 0 0; font-size:0.85rem;">Faça login e clique em "Receber Avisos". Pronto! 🎉</p>
            </div>
        </div>
    `;

    // Remove modal anterior, se houver
    const old = document.getElementById('install-tutorial-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'install-tutorial-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(6px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = `
        <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:28px; max-width:420px; width:100%; max-height:90vh; overflow-y:auto; animation: scaleUp 0.3s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0; color:#fff; font-size:1.15rem; font-weight:700;">📲 Instalar o App no Celular</h3>
                <span id="close-install-tutorial" style="color:#94a3b8; font-size:1.6rem; cursor:pointer; line-height:1;">&times;</span>
            </div>
            <p style="color:#94a3b8; font-size:0.88rem; margin-bottom:22px; line-height:1.5;">
                Para receber notificações no iPhone, a Apple exige que o app esteja instalado na sua tela inicial. É rápido e simples:
            </p>
            ${steps}
            <button id="btn-close-tutorial" style="width:100%; padding:14px; margin-top:22px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:10px; font-size:0.9rem; cursor:pointer;">
                Entendi, vou instalar!
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-install-tutorial').addEventListener('click', () => modal.remove());
    document.getElementById('btn-close-tutorial').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// Verifica se está dentro do prazo: das 07:00 do dia do evento até Domingo 12:00
function isJustificationAllowed(evtRawDateStr) {
    if (!evtRawDateStr) return false;

    const evtDate = new Date(evtRawDateStr);
    if (isNaN(evtDate)) return false;

    // Início: 07:00 da manhã do dia do evento (usando a data do evento)
    const startDate = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate(), 7, 0, 0, 0);

    // Prazo Final: Domingo seguinte às 12:00
    const limitDate = new Date(evtDate.getFullYear(), evtDate.getMonth(), evtDate.getDate(), 12, 0, 0, 0);
    const dayOfWeek = limitDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    limitDate.setDate(limitDate.getDate() + daysUntilSunday);
    limitDate.setHours(12, 0, 0, 0); // Domingo, 12:00:00

    const agora = new Date();
    return agora >= startDate && agora <= limitDate;
}

window.isJustificationAllowed = isJustificationAllowed;

// ==========================================
// SEÇÃO DE BIBLIOTECA - PORTAL DO ALUNO
// ==========================================

export async function renderStudentLibrary(email) {
    const cardContainer = document.getElementById('library-card-container');
    if (!cardContainer) return;

    cardContainer.innerHTML = `
        <div class="presence-card animate-fade-in" style="background: var(--glass-bg); padding: 24px; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow); margin-bottom: 20px;">
            <h3 style="margin-top: 0; margin-bottom: 6px; font-weight: 700; font-size: 1.2rem; color: #fff; letter-spacing: -0.02em;">Biblioteca do Terreiro</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Consulte os livros disponíveis e acompanhe seus empréstimos ativos.</p>
            <div id="library-loading" class="loader active"></div>
            <div id="student-loans-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;"></div>
            <button id="btn-open-library" style="width: 100%; padding: 14px; font-size: 0.95rem; border-radius: 12px; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px;">
                📚 Acessar Vitrine de Livros
            </button>
        </div>
    `;

    try {
        const json = await apiFetch('getBooksData', { params: { email } });

        const loader = document.getElementById('library-loading');
        if (loader) loader.classList.remove('active');

        if (json.status === "success") {
            window.libraryData = {
                books: json.books || [],
                loans: json.loans || []
            };

            renderStudentLoans(email);

            // Bind de abertura do modal
            document.getElementById('btn-open-library').addEventListener('click', () => {
                const searchInput = document.getElementById('library-search-input');
                if (searchInput) searchInput.value = '';
                window.activeLibraryCategory = 'Todos';
                openModalById('library-modal');
                renderBooksShowcase('');
            });
        } else {
            const listDiv = document.getElementById('student-loans-list');
            if (listDiv) listDiv.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem; text-align: center;">Erro ao carregar acervo: ${json.message}</p>`;
        }
    } catch (e) {
        const loader = document.getElementById('library-loading');
        if (loader) loader.classList.remove('active');
        const listDiv = document.getElementById('student-loans-list');
        if (listDiv) listDiv.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem; text-align: center;">Erro de conexão com o servidor.</p>';
    }
}

function renderStudentLoans(email) {
    const listDiv = document.getElementById('student-loans-list');
    if (!listDiv || !window.libraryData) return;

    listDiv.innerHTML = '';
    const myLoans = window.libraryData.loans.filter(l => l.email.toLowerCase().trim() === email.toLowerCase().trim() && l.status !== "Devolvido" && l.status !== "Cancelado");

    if (myLoans.length === 0) {
        listDiv.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin: 10px 0; font-style: italic;">Você não possui nenhum empréstimo ativo no momento.</p>`;
        return;
    }

    myLoans.forEach(loan => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.015)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        item.style.borderRadius = '12px';
        item.style.padding = '12px 16px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.flexWrap = 'wrap';
        item.style.gap = '10px';

        let badgeClass = 'badge-loan-requested';
        let badgeLabel = 'Solicitado';
        let dateLabel = '';

        if (loan.status === 'Ativo') {
            badgeClass = 'badge-loan-active';
            badgeLabel = 'Com Você';
            const expectedDate = new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR');
            dateLabel = `<span style="font-size:0.75rem; color:var(--text-muted)">Devolução prevista: <strong style="color:#fff">${expectedDate}</strong></span>`;
        } else if (loan.status === 'Atrasado') {
            badgeClass = 'badge-loan-overdue';
            badgeLabel = 'ATRASADO ⚠️';
            const expectedDate = new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR');
            dateLabel = `<span style="font-size:0.75rem; color:#f87171">Devolução prevista: <strong>${expectedDate}</strong></span>`;
        } else {
            dateLabel = `<span style="font-size:0.75rem; color:var(--text-muted)">Aguardando retirada física</span>`;
        }

        item.innerHTML = `
            <div style="flex: 1; min-width: 150px;">
                <h4 style="font-size: 0.9rem; color: #fff; margin: 0; font-weight: 600;">${loan.tituloLivro}</h4>
                <div style="margin-top: 4px; display: flex; flex-direction: column;">
                    ${dateLabel}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge-loan ${badgeClass}">${badgeLabel}</span>
                ${loan.status === 'Solicitado' ? `
                    <button class="btn-cancel-loan-request" data-loan-id="${loan.id}" style="padding: 6px 10px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #fff; border-radius: 8px; cursor: pointer; font-weight: 500; border: none;">
                        Cancelar
                    </button>
                ` : ''}
            </div>
        `;

        listDiv.appendChild(item);
    });

    // Event listener para cancelamentos
    listDiv.querySelectorAll('.btn-cancel-loan-request').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            if (confirm("Deseja realmente cancelar esta solicitação de empréstimo?")) {
                const originalText = e.currentTarget.innerHTML;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '...';

                try {
                    const res = await apiFetch('cancelBookLoanRequest', {
                        method: 'POST',
                        data: { loanId }
                    });

                    if (res.status === 'success') {
                        alert(res.message);
                        await renderStudentLibrary(email);
                        const libModal = document.getElementById('library-modal');
                        if (libModal && libModal.style.display === 'block') {
                            renderBooksShowcase(document.getElementById('library-search-input').value);
                        }
                    } else {
                        alert("Erro: " + res.message);
                        e.currentTarget.disabled = false;
                        e.currentTarget.innerHTML = originalText;
                    }
                } catch (err) {
                    alert("Erro ao conectar com o servidor.");
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalText;
                }
            }
        });
    });
}

export function renderBooksShowcase(filterQuery = '') {
    const listDiv = document.getElementById('library-books-list');
    const categoriesContainer = document.getElementById('library-categories-container');
    if (!listDiv || !window.libraryData) return;

    const query = filterQuery.toLowerCase().trim();
    const email = localStorage.getItem('tuig_email');

    // 1. Extrair categorias únicas de todos os livros
    const books = window.libraryData.books;
    const categories = ['Todos', ...new Set(books.map(b => b.categoria).filter(Boolean))];

    // Inicializa categoria padrão se não definida
    if (!window.activeLibraryCategory) {
        window.activeLibraryCategory = 'Todos';
    }

    // 2. Renderizar botões de categorias se houver mais de uma categoria
    if (categoriesContainer) {
        categoriesContainer.innerHTML = '';
        if (categories.length > 1) {
            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.innerText = cat;
                btn.style.padding = '8px 16px';
                btn.style.fontSize = '0.8rem';
                btn.style.borderRadius = '20px';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.style.flex = '0 0 auto';
                btn.style.fontWeight = '600';
                btn.style.transition = 'all 0.2s';

                if (window.activeLibraryCategory === cat) {
                    btn.style.background = 'var(--primary)';
                    btn.style.color = '#fff';
                } else {
                    btn.style.background = 'rgba(255, 255, 255, 0.05)';
                    btn.style.color = 'var(--text-muted)';
                }

                btn.addEventListener('click', () => {
                    window.activeLibraryCategory = cat;
                    // Re-renderiza mantendo a busca atual
                    const currentSearch = document.getElementById('library-search-input')?.value || '';
                    renderBooksShowcase(currentSearch);
                });

                categoriesContainer.appendChild(btn);
            });
            categoriesContainer.style.display = 'flex';
        } else {
            categoriesContainer.style.display = 'none';
        }
    }

    listDiv.innerHTML = '';

    // 3. Filtrar livros por busca e por categoria
    const filteredBooks = books.filter(b => {
        const matchesSearch = b.titulo.toLowerCase().includes(query) || b.autor.toLowerCase().includes(query);
        const matchesCategory = window.activeLibraryCategory === 'Todos' || b.categoria === window.activeLibraryCategory;
        return matchesSearch && matchesCategory;
    });

    if (filteredBooks.length === 0) {
        listDiv.innerHTML = `<p style="color: var(--text-muted); font-size: 0.95rem; text-align: center; grid-column: 1/-1; padding: 40px 0;">Nenhum livro encontrado para os filtros selecionados.</p>`;
        return;
    }

    filteredBooks.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card animate-fade-in';

        const activeUserLoans = window.libraryData.loans.filter(l =>
            l.livroId === book.id &&
            l.email.toLowerCase().trim() === email.toLowerCase().trim() &&
            l.status !== 'Devolvido' &&
            l.status !== 'Cancelado'
        );

        let statusBadge = '';
        let actionButton = '';

        if (activeUserLoans.length > 0) {
            const loan = activeUserLoans[0];
            if (loan.status === 'Solicitado') {
                statusBadge = `<span class="badge-loan badge-loan-requested">Solicitado por você</span>`;
                actionButton = `
                    <button class="btn-cancel-showcase-request" data-loan-id="${loan.id}" style="width: 100%; padding: 12px; font-size: 0.9rem; border-radius: 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; cursor: pointer;">
                        Cancelar Reserva
                    </button>
                `;
            } else if (loan.status === 'Ativo') {
                const expDate = new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR');
                statusBadge = `<span class="badge-loan badge-loan-active">Com você</span>`;
                actionButton = `
                    <button disabled style="width: 100%; padding: 12px; font-size: 0.9rem; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); color: var(--text-muted); cursor: not-allowed;">
                        Devolver até ${expDate}
                    </button>
                `;
            } else if (loan.status === 'Atrasado') {
                statusBadge = `<span class="badge-loan badge-loan-overdue">ATRASADO ⚠️</span>`;
                actionButton = `
                    <button disabled style="width: 100%; padding: 12px; font-size: 0.9rem; border-radius: 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; cursor: not-allowed;">
                        Atrasado! Devolva no Terreiro.
                    </button>
                `;
            }
        } else {
            if (book.qtdDisponivel > 0) {
                statusBadge = `<span class="badge-loan badge-loan-returned" style="color: #34d399; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">${book.qtdDisponivel} Disponível(is)</span>`;
                actionButton = `
                    <button class="btn-request-loan" data-book-id="${book.id}" style="width: 100%; padding: 12px; font-size: 0.9rem; border-radius: 10px; font-weight:600; cursor:pointer;">
                        Solicitar Empréstimo
                    </button>
                `;
            } else {
                statusBadge = `<span class="badge-loan badge-loan-overdue" style="background: rgba(239, 68, 68, 0.05); color: #ef4444; border-color: rgba(239, 68, 68, 0.15);">Sem estoque</span>`;
                actionButton = `
                    <button disabled style="width: 100%; padding: 12px; font-size: 0.9rem; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); color: var(--text-muted); cursor: not-allowed;">
                        Indisponível no momento
                    </button>
                `;
            }
        }

        let coverHtml = '';
        if (book.capaUrl && book.capaUrl.startsWith('http')) {
            coverHtml = `
                <div class="book-cover-container">
                    <img src="${book.capaUrl}" class="book-cover-img" alt="Capa de ${book.titulo}">
                </div>
            `;
        } else {
            coverHtml = `
                <div class="book-cover-container">
                    <div class="book-cover-css">
                        <div class="book-cover-css-title">${book.titulo}</div>
                        <div class="book-cover-css-author">${book.autor}</div>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            ${coverHtml}
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                        <div style="flex: 1; min-width: 0;">
                            <h4 class="book-info-title" title="${book.titulo}">${book.titulo}</h4>
                        </div>
                        <div style="flex-shrink: 0;">
                            ${statusBadge}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <span class="badge-loan" style="font-size: 0.65rem; padding: 3px 8px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-transform: uppercase;">${book.categoria || 'Geral'}</span>
                    </div>
                    <p class="book-info-author" title="${book.autor}">por ${book.autor || 'Autor desconhecido'}</p>
                    
                    <div class="book-info-detail">📍 Local: <strong>${book.localizacao || 'Não especificado'}</strong></div>
                    <div class="book-info-detail">📚 Prazo: <strong>15 Dias de empréstimo</strong></div>
                    
                    ${book.sinopse ? `
                        <div style="margin-top: 10px; margin-bottom: 12px;">
                            <button class="book-synopsis-toggle" data-id="${book.id}">Ver Sinopse</button>
                            <div class="book-synopsis-text" id="synopsis-${book.id}">${book.sinopse}</div>
                        </div>
                    ` : '<div style="height: 15px;"></div>'}
                </div>
                <div style="margin-top: auto;">
                    ${actionButton}
                </div>
            </div>
        `;

        listDiv.appendChild(card);
    });

    // Bind para toggles de sinopse
    listDiv.querySelectorAll('.book-synopsis-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const synDiv = document.getElementById(`synopsis-${id}`);
            if (synDiv) {
                if (synDiv.style.display === 'block') {
                    synDiv.style.display = 'none';
                    e.currentTarget.innerText = 'Ver Sinopse';
                } else {
                    synDiv.style.display = 'block';
                    e.currentTarget.innerText = 'Fechar Sinopse';
                }
            }
        });
    });

    // Bind para solicitação de empréstimo
    listDiv.querySelectorAll('.btn-request-loan').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const bookId = e.currentTarget.getAttribute('data-book-id');
            const studentName = document.getElementById('user-name').innerText;

            if (confirm("Você terá 15 dias para ler e devolver este livro fisicamente ao terreiro. Deseja solicitar o empréstimo?")) {
                const originalText = e.currentTarget.innerHTML;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = 'Enviando...';

                try {
                    const res = await apiFetch('requestBookLoan', {
                        method: 'POST',
                        data: {
                            livroId: bookId,
                            email: email,
                            nome: studentName
                        }
                    });

                    if (res.status === 'success') {
                        alert(res.message);
                        await renderStudentLibrary(email);
                        renderBooksShowcase(document.getElementById('library-search-input').value);
                    } else {
                        alert("Erro: " + res.message);
                        e.currentTarget.disabled = false;
                        e.currentTarget.innerHTML = originalText;
                    }
                } catch (err) {
                    alert("Erro ao conectar com o servidor.");
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalText;
                }
            }
        });
    });

    // Bind para cancelamento direto da vitrine
    listDiv.querySelectorAll('.btn-cancel-showcase-request').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            if (confirm("Deseja realmente cancelar esta solicitação de empréstimo?")) {
                const originalText = e.currentTarget.innerHTML;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '...';

                try {
                    const res = await apiFetch('cancelBookLoanRequest', {
                        method: 'POST',
                        data: { loanId }
                    });

                    if (res.status === 'success') {
                        alert(res.message);
                        await renderStudentLibrary(email);
                        renderBooksShowcase(document.getElementById('library-search-input').value);
                    } else {
                        alert("Erro: " + res.message);
                        e.currentTarget.disabled = false;
                        e.currentTarget.innerHTML = originalText;
                    }
                } catch (err) {
                    alert("Erro ao conectar com o servidor.");
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalText;
                }
            }
        });
    });
}

window.renderStudentLibrary = renderStudentLibrary;
window.renderBooksShowcase = renderBooksShowcase;

/**
 * GESTÃO DE CURSOS TUIG NA ÁREA DO ALUNO
 */
export async function renderStudentCourses(email) {
    const cardContainer = document.getElementById('courses-card-container');
    if (!cardContainer) return;

    cardContainer.innerHTML = `
        <div class="presence-card animate-fade-in" style="background: var(--glass-bg); padding: 28px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow); margin-bottom: 24px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #10b981, #6366f1);"></div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="margin: 0; font-weight: 700; font-size: 1.3rem; color: #fff; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
                        <span>🎓</span> Cursos TUIG
                    </h3>
                </div>
            </div>

            <!-- Aviso Destacado de Não Permissão de Crianças -->
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 14px; padding: 12px 16px; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; color: #fca5a5; font-size: 0.85rem; line-height: 1.4;">
                <span style="font-size: 1.25rem; flex-shrink: 0;">🚫</span>
                <span><strong style="color: #f87171;">Aviso importante:</strong> Não é permitida a presença de crianças (de qualquer idade) durante a realização dos cursos.</span>
            </div>

            <div id="courses-loading" class="loader active"></div>
            <div id="student-courses-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 16px;"></div>
        </div>
    `;

    try {
        const json = await apiFetch('getCoursesData', { params: { email } });
        const loader = document.getElementById('courses-loading');
        if (loader) loader.classList.remove('active');

        if (json.status === "success" && json.data) {
            const { availableCourses, userEnrollments, userName, userTurma } = json.data;
            window.tuigStudentCoursesData = json.data;
            renderCoursesGrid(email, availableCourses, userEnrollments, userName, userTurma);
        } else {
            const list = document.getElementById('student-courses-list');
            if (list) list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Nenhum curso disponível no momento.</p>`;
        }
    } catch (e) {
        console.error("Erro ao carregar cursos:", e);
        const loader = document.getElementById('courses-loading');
        if (loader) loader.classList.remove('active');
        const list = document.getElementById('student-courses-list');
        if (list) list.innerHTML = `<p style="color: #f87171; font-size: 0.9rem;">Erro ao conectar com o servidor.</p>`;
    }
}

function renderCoursesGrid(email, availableCourses, userEnrollments, userName, userTurma) {
    const listDiv = document.getElementById('student-courses-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!availableCourses || availableCourses.length === 0) {
        listDiv.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">Nenhum curso cadastrado no momento.</p>`;
        return;
    }

    const enrollmentMap = {};
    if (userEnrollments) {
        userEnrollments.forEach(en => {
            if (en.curso) {
                enrollmentMap[en.curso.toLowerCase().trim()] = en;
            }
        });
    }

    availableCourses.forEach(course => {
        const courseName = course.nome;
        const valorStr = course.valor || "Grátis";
        const valorClean = valorStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isFree = valorClean.includes("gratis") || valorClean.includes("gratuito") || valorClean === "0" || valorClean === "r$ 0,00" || valorClean === "r$ 0";

        const existingEnrollment = enrollmentMap[courseName.toLowerCase().trim()];

        const card = document.createElement('div');
        card.className = 'course-card';
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 16px;
            transition: all 0.3s;
            position: relative;
        `;

        const badgeBg = isFree ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)';
        const badgeColor = isFree ? '#34d399' : '#fbbf24';
        const badgeBorder = isFree ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)';

        let actionHtml = '';

        if (existingEnrollment) {
            const hasComprovante = existingEnrollment.comprovante && existingEnrollment.comprovante.startsWith('http');
            actionHtml = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #34d399; padding: 12px 14px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; text-align: center; display: flex; flex-direction: column; gap: 4px;">
                    <span>✅ Inscrição Efetivada</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">Inscrito em ${existingEnrollment.data || 'Data recente'}</span>
                    ${hasComprovante ? `<a href="${existingEnrollment.comprovante}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 0.78rem; margin-top: 4px;">📄 Ver Comprovante Enviado</a>` : ''}
                </div>
            `;
        } else {
            actionHtml = `
                <button class="btn-enroll-course" data-course="${courseName}" data-price="${valorStr}" style="width: 100%; padding: 12px; background: var(--primary); color: #fff; border: none; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: var(--glow-shadow);">
                    ${isFree ? '⚡ Inscrever-se (Gratuito)' : '📝 Inscrever-se'}
                </button>
            `;
        }

        let dateText = course.data || "";
        if (dateText.includes("GMT") || dateText.includes("00:00:00")) {
            const d = new Date(dateText);
            dateText = !isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : dateText;
        }
        let descText = course.descricao || (dateText ? `Data: ${dateText}` : "");
        if (descText.includes("GMT") || descText.includes("00:00:00")) {
            descText = `Data: ${dateText}`;
        }

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; border: ${badgeBorder}; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                        ${isFree ? '✨ GRÁTIS' : `💰 ${valorStr}`}
                    </span>
                </div>
                <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 1.05rem; font-weight: 700;">${courseName}</h4>
                <p style="margin: 0; color: var(--text-muted); font-size: 0.83rem; line-height: 1.4;">${descText}</p>
            </div>
            <div>
                ${actionHtml}
            </div>
        `;

        listDiv.appendChild(card);
    });

    // Eventos dos botões de inscrição
    listDiv.querySelectorAll('.btn-enroll-course').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const course = e.currentTarget.getAttribute('data-course');
            const price = e.currentTarget.getAttribute('data-price');
            openCourseEnrollModal(email, course, price, userName, userTurma);
        });
    });
}

function openCourseEnrollModal(email, courseName, priceStr, userName, userTurma) {
    const valorClean = (priceStr || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isFree = valorClean.includes("gratis") || valorClean.includes("gratuito") || valorClean === "0" || valorClean === "r$ 0,00" || valorClean === "r$ 0";

    let modal = document.getElementById('course-enroll-modal');
    if (!modal) {
        const modalsContainer = document.getElementById('modals-container') || document.body;
        modalsContainer.insertAdjacentHTML('beforeend', `
            <div id="course-enroll-modal" class="modal">
                <div class="modal-content" style="max-width: 480px; width: 95%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h2 style="margin:0; font-size:1.4rem; font-weight:800; letter-spacing:-0.03em;">Inscrição no Curso</h2>
                        <span id="close-course-enroll-modal" class="close-modal" style="position:static; color:#fff; font-size:1.8rem; line-height:1; cursor:pointer;">&times;</span>
                    </div>

                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 16px; border-radius: 14px; margin-bottom: 16px;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Curso Selecionado</div>
                        <div id="enroll-modal-course-title" style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-top: 4px;"></div>
                        <div id="enroll-modal-course-price" style="font-size: 0.9rem; font-weight: 600; color: var(--accent); margin-top: 4px;"></div>
                    </div>

                    <!-- Aviso de Não Permissão de Crianças no Modal -->
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.22); border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; color: #fca5a5; font-size: 0.83rem; line-height: 1.4; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.15rem; flex-shrink: 0;">🚫</span>
                        <span><strong style="color: #f87171;">Atenção:</strong> Não é permitida a presença de crianças (de qualquer idade) durante o curso.</span>
                    </div>

                    <!-- Aviso Destacado Obrigatório para Cursos Pagos -->
                    <div id="enroll-paid-notice" style="display: none; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 14px; padding: 16px; margin-bottom: 20px; color: #fbbf24; font-size: 0.88rem; line-height: 1.4;">
                        <strong>⚠️ ATENÇÃO:</strong> Este é um curso pago. Para efetivar sua inscrição, é <span style="text-decoration: underline; font-weight: 700;">obrigatório</span> anexar o comprovante de pagamento Pix ou transferência. Sua vaga só será garantida após o envio do comprovante.
                    </div>

                    <div id="enroll-file-section" style="margin-bottom: 20px; display: none;">
                        <label style="display:block; margin-bottom: 8px; color:#fff; font-size:0.9rem; font-weight: 500;">Anexar Comprovante (Imagem ou PDF) *:</label>
                        <input type="file" id="course-receipt-file-input" accept="image/*,application/pdf" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 10px; font-size: 0.9rem; outline: none;">
                    </div>

                    <button id="btn-submit-course-enroll" style="width: 100%; padding: 16px; font-size: 1rem; border-radius: 12px; display: flex; justify-content: center; align-items: center; gap: 8px; background: var(--primary); color: #fff; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; box-shadow: var(--glow-shadow);">
                        Confirmar Inscrição
                    </button>
                    
                    <div id="course-enroll-feedback" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></div>
                </div>
            </div>
        `);

        document.getElementById('close-course-enroll-modal').addEventListener('click', () => {
            closeModalById('course-enroll-modal');
        });
    }

    document.getElementById('enroll-modal-course-title').innerText = courseName;
    document.getElementById('enroll-modal-course-price').innerText = isFree ? "Valor: Grátis" : `Valor: ${priceStr}`;

    const paidNotice = document.getElementById('enroll-paid-notice');
    const fileSection = document.getElementById('enroll-file-section');
    const fileInput = document.getElementById('course-receipt-file-input');
    const feedback = document.getElementById('course-enroll-feedback');
    const btnSubmit = document.getElementById('btn-submit-course-enroll');

    feedback.innerHTML = '';
    if (fileInput) fileInput.value = '';

    if (isFree) {
        paidNotice.style.display = 'none';
        fileSection.style.display = 'none';
        btnSubmit.innerHTML = '⚡ Confirmar Inscrição Gratuita';
    } else {
        paidNotice.style.display = 'block';
        fileSection.style.display = 'block';
        btnSubmit.innerHTML = '📄 Enviar Comprovante e Efetivar Inscrição';
    }

    btnSubmit.onclick = async () => {
        if (!isFree && (!fileInput.files || fileInput.files.length === 0)) {
            feedback.innerHTML = '<span style="color:#f87171; font-weight: 600;">⚠️ Selecione o arquivo do comprovante para efetivar a inscrição.</span>';
            return;
        }

        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = 'Processando...';
        feedback.innerHTML = '';

        try {
            let fileBase64 = null;
            let fileName = null;
            let mimeType = null;

            if (!isFree && fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    feedback.innerHTML = '<span style="color:#f87171">O arquivo do comprovante deve ter no máximo 5MB.</span>';
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = originalText;
                    return;
                }
                fileName = file.name;
                mimeType = file.type;

                fileBase64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            const json = await apiFetch('enrollCourse', {
                method: 'POST',
                data: {
                    email,
                    nome: userName,
                    turma: userTurma,
                    curso: courseName,
                    valor: priceStr,
                    fileBase64,
                    fileName,
                    mimeType
                }
            });

            if (json.status === "success") {
                feedback.innerHTML = `<span style="color:#34d399; font-weight:600;">✅ ${json.message}</span>`;
                setTimeout(async () => {
                    closeModalById('course-enroll-modal');
                    await renderStudentCourses(email);
                }, 1800);
            } else {
                feedback.innerHTML = `<span style="color:#f87171">Erro: ${json.message}</span>`;
            }
        } catch (err) {
            console.error("Erro na inscrição:", err);
            feedback.innerHTML = '<span style="color:#f87171">Erro na conexão com o servidor. Tente novamente.</span>';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    };

    openModalById('course-enroll-modal');
}

window.renderStudentCourses = renderStudentCourses;


