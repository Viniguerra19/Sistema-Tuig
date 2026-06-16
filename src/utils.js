/**
 * Utilitários compartilhados do Sistema TUIG
 */

export function normalizeText(text) {
    if (!text) return "";
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function getAreaClass(text) {
    if (!text) return "";
    const t = text.toLowerCase();
    if (t.includes("benzimento")) return "area-benzimento";
    if (t.includes("apometria")) return "area-apometria";
    if (t.includes("ervaria")) return "area-ervaria";
    if (t.includes("oriente")) return "area-oriente";
    if (t.includes("bruxaria")) return "area-bruxaria";
    return "";
}

export function getBadgeClass(text) {
    if (!text) return "";
    const t = text.toLowerCase();
    if (t.includes("benzimento")) return "badge-benzimento";
    if (t.includes("apometria")) return "badge-apometria";
    if (t.includes("ervaria")) return "badge-ervaria";
    if (t.includes("oriente")) return "badge-oriente";
    if (t.includes("bruxaria")) return "badge-bruxaria";
    return "";
}

export function formatDate(date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString('pt-BR');
}

export function populateMonthFilter(data, selectId) {
    const select = document.getElementById(selectId);
    if (!select || !data) return;

    select.innerHTML = '<option value="all">Todos os Meses</option>';

    const monthsWithData = new Set();
    data.forEach(evt => {
        const parts = evt.data.split('/');
        const monthIndex = parseInt(parts[1]) - 1;
        monthsWithData.add(monthIndex);
    });

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    Array.from(monthsWithData).sort((a, b) => a - b).forEach(mIndex => {
        const option = document.createElement('option');
        option.value = mIndex;
        option.innerText = monthNames[mIndex];
        select.appendChild(option);
    });
}

export function openModalById(modalId, filterFn, dataForFilter, monthSelectId) {
    document.getElementById(modalId).style.display = 'block';
    if (dataForFilter && monthSelectId) {
        populateMonthFilter(dataForFilter, monthSelectId);
    }
    if (filterFn) filterFn();
}

export function closeModalById(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

export function renderGenericHistory(config) {
    const { listId, data, yearFilterId, monthFilterId } = config;
    const listDiv = document.getElementById(listId);
    if (!listDiv) return;

    listDiv.innerHTML = '';

    if (!data || data.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum registro encontrado.</p>';
        return;
    }

    const yearFilter = document.getElementById(yearFilterId).value;
    const monthFilter = document.getElementById(monthFilterId).value;

    const filtered = data.filter(evt => {
        const parts = evt.data.split('/');
        const evtDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const yearMatch = yearFilter === 'all' || evtDate.getFullYear().toString() === yearFilter;
        const monthMatch = monthFilter === 'all' || evtDate.getMonth().toString() === monthFilter;
        return yearMatch && monthMatch;
    });

    if (filtered.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Nenhum evento neste período.</p>';
        return;
    }

    let html = '';
    filtered.forEach(evt => {
        const isPresent = evt.status === "Presente";
        const isAbono = evt.status === "Abono";
        
        let color = "#f87171"; // Ausente (danger)
        let bg = "rgba(239, 68, 68, 0.05)";
        let border = "rgba(239, 68, 68, 0.1)";
        
        if (isPresent) {
            color = "#10b981"; // success
            bg = "rgba(16, 185, 129, 0.05)";
            border = "rgba(16, 185, 129, 0.1)";
        } else if (isAbono) {
            color = "#f59e0b"; // warning (orange/amber)
            bg = "rgba(245, 158, 11, 0.05)";
            border = "rgba(245, 158, 11, 0.1)";
        }

        let btnJustificarHtml = '';
        if (evt.status === "Ausente" && window.isJustificationAllowed && window.isJustificationAllowed(evt.rawDate)) {
             btnJustificarHtml = `
                <button class="btn-justificar-hist" data-date="${evt.data}" style="margin-top:6px; padding:4px 8px; font-size:0.7rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    📝 Justificar
                </button>
             `;
        }

        html += `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 15px; padding:16px 20px; background: ${bg}; border: 1px solid ${border}; border-radius: 14px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <div style="font-weight:700; color:#fff; font-size: 0.95rem; margin-bottom: 2px;">${evt.nome}</div>
                    <div style="color:var(--text-muted); font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${evt.data}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div style="color:${color}; font-weight:700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display:flex; align-items:center; gap: 6px; padding: 6px 12px; background: rgba(0,0,0,0.2); border-radius: 10px;">
                        <span style="width: 6px; height: 6px; background: ${color}; border-radius: 50%; box-shadow: 0 0 8px ${color};"></span>
                        ${evt.status}
                    </div>
                    ${btnJustificarHtml}
                </div>
            </div>
        `;
    });
    listDiv.innerHTML = html;
    
    // Bind buttons
    setTimeout(() => {
        document.querySelectorAll('.btn-justificar-hist').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateStr = e.currentTarget.getAttribute('data-date');
                window.currentJustificationDate = dateStr;
                const feedback = document.getElementById('justification-feedback');
                if(feedback) feedback.innerHTML = '';
                const txt = document.getElementById('justification-text');
                if(txt) txt.value = '';
                
                // Modals transitions
                const histModal = document.getElementById('history-modal');
                if(histModal) histModal.style.display = 'none';
                
                const justifModal = document.getElementById('justification-modal');
                if(justifModal) justifModal.style.display = 'block';
            });
        });
    }, 100);
}
