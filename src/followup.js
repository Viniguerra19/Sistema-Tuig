import { apiFetch, normalizeText } from './utils.js';
import './followup.css';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateLabel = value => value?.length === 10 ? value.split('-').reverse().join('/') : value?.split('-').reverse().join('/') || '—';
const topicLabel = topic => topic === 'mensalidade' ? 'Mensalidade' : 'Presença';
export function messageFor(item) {
    const first = item.name.trim().split(/\s+/)[0] || 'tudo bem';
    return item.topic === 'mensalidade'
        ? `Oi, ${first}! Tudo bem? Estou conferindo as mensalidades do terreiro e não encontrei o registro de ${dateLabel(item.reference)}. Você consegue me confirmar se já realizou o pagamento? Se já enviou o comprovante, me avise para eu conferir. Obrigado!`
        : `Oi, ${first}! Tudo bem com você? Não encontrei sua presença registrada no terreiro em ${dateLabel(item.reference)}. Você esteve lá e esqueceu de marcar, ou não conseguiu participar? Queria saber se está tudo bem e se podemos ajudar.`;
}
export function whatsappLink(phone, message) {
    return /^[1-9]\d{6,14}$/.test(phone) && message.trim() ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}
export function filterCases(cases, filters, today) {
    return cases.filter(c => (!filters.search || normalizeText(`${c.name} ${c.email}`).includes(normalizeText(filters.search)))
        && (!filters.turma || c.turma === filters.turma)
        && (!filters.topic || c.topic === filters.topic)
        && (filters.status === 'all' || (filters.status === 'open' ? c.status !== 'Resolvido'
            : filters.status === 'due' ? c.status === 'Retomar' && c.nextDate <= today : c.status === filters.status)));
}

export function renderFollowupCenter(root, email) {
    root.dataset.ready = 'true';
    let data, page = 0, selectedKey = '', draft = null, requestId = '', isSaving = false;
    const now = new Date(), previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const begin = new Date(now); begin.setDate(begin.getDate() - 30);
    const filters = { search: '', turma: '', topic: '', status: 'open', from: localDay(begin), to: localDay(now), month: localDay(previous).slice(0, 7) };
    const q = selector => root.querySelector(selector);
    const flash = message => { const el = q('[data-feedback]'); if (el) el.textContent = message; };
    async function api(action, options) {
        let result;
        try { result = await apiFetch(action, options); }
        catch (error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('O servidor demorou a responder.');
            throw error;
        }
        if (result.status !== 'success') throw new Error(result.message || 'Não foi possível concluir.');
        return result;
    }
    function shell() {
        root.innerHTML = `<div class="fu"><header><p class="fu-eyebrow">ADMINISTRAÇÃO · CONTATOS MANUAIS</p><h2>Quem precisa de atenção?</h2>
            <p>Prepare a conversa aqui. Envie pelo seu WhatsApp pessoal. Registre o contato só depois de realizá-lo.</p></header>
            <div class="fu-summary" data-summary></div>
            <form class="fu-filters">
                <label>Presenças: de<input type="date" name="from" value="${filters.from}" required></label>
                <label>Até<input type="date" name="to" value="${filters.to}" required></label>
                <label data-month-label>Mensalidade<input type="month" name="month" value="${filters.month}" max="${localDay(previous).slice(0, 7)}" required></label>
                <button type="submit">Atualizar período</button>
                <label>Buscar pessoa<input name="search" placeholder="Nome ou e-mail" type="search"></label>
                <label>Turma<select name="turma"><option value="">Todas</option></select></label>
                <label>Assunto<select name="topic"><option value="">Todos</option><option value="presenca">Presença</option><option value="mensalidade">Mensalidade</option></select></label>
                <label>Situação<select name="status"><option value="open">Em acompanhamento</option><option value="Pendente">Pendente / para conferir</option><option value="Aguardando resposta">Aguardando resposta</option><option value="due">Retomar hoje ou atrasados</option><option value="Retomar">Todos os retornos</option><option value="Resolvido">Resolvidos</option><option value="all">Todas</option></select></label>
            </form>
            <p class="fu-note" data-warning></p><p data-feedback role="status" aria-live="polite"></p>
            <div class="fu-layout"><section aria-label="Pessoas para acompanhar"><div data-list></div><div class="fu-toolbar" data-pages></div></section>
                <section class="fu-detail" data-detail aria-label="Detalhes do acompanhamento"><p>Selecione uma pessoa para preparar a mensagem e ver seu histórico.</p></section></div>
            <details class="fu-history"><summary>Histórico de contatos e atualizações</summary><p>Inclui registros antigos, mesmo quando a pendência deixou de existir. Abrir o WhatsApp não cria um registro.</p><div data-history></div></details>
        </div>`;
        q('.fu-filters').onsubmit = async e => {
            e.preventDefault();
            if (isSaving) return;
            if (draft && !window.confirm('Atualizar descarta a mensagem não salva. Continuar?')) return;
            ['from', 'to', 'month'].forEach(k => filters[k] = q(`[name=${k}]`).value);
            selectedKey = ''; draft = null; await refresh();
        };
        ['search', 'turma', 'topic', 'status'].forEach(k => q(`[name=${k}]`).addEventListener(k === 'search' ? 'input' : 'change', e => {
            filters[k] = e.target.value; page = 0; list(); history();
        }));
    }
    async function refresh() {
        flash('Carregando acompanhamento…');
        const button = q('[type=submit]'); button.disabled = true;
        try {
            const result = await api('getFollowupData', { params: { adminEmail: email, from: filters.from, to: filters.to, month: filters.month } });
            data = result.data; page = 0;
            q('[data-warning]').textContent = data.warning;
            q('[data-month-label]').hidden = !data.isMaster;
            q('[name=topic] option[value=mensalidade]').disabled = !data.isMaster;
            q('[name=turma]').innerHTML = '<option value="">Todas</option>' + [...new Set(data.cases.map(c => c.turma))].filter(Boolean).sort().map(t => `<option>${escapeHtml(t)}</option>`).join('');
            q('[name=turma]').value = filters.turma;
            if (!q('[name=turma]').value) filters.turma = '';
            const open = data.cases.filter(c => c.status !== 'Resolvido');
            q('[data-summary]').innerHTML = [
                [new Set(open.map(c => c.email)).size, 'pessoas para acompanhar'],
                [open.filter(c => c.topic === 'presenca').length, 'presenças a conferir'],
                ...(data.isMaster ? [[open.filter(c => c.topic === 'mensalidade').length, 'mensalidades a conferir']] : []),
                [open.filter(c => c.status === 'Retomar' && c.nextDate <= data.today).length, 'retornos para hoje ou atrasados']
            ].map(([n, title]) => `<div><strong>${n}</strong><span>${title}</span></div>`).join('');
            list(); history();
            const selected = data.cases.find(c => c.key === selectedKey);
            if (selected) detail(selected);
            else { selectedKey = ''; q('[data-detail]').innerHTML = '<p>Selecione uma pessoa para preparar a mensagem e ver seu histórico.</p>'; }
            flash('Dados atualizados. Nenhuma mensagem foi enviada.');
        } catch (error) { flash(error.message + ' Os dados não foram atualizados.'); }
        finally { button.disabled = false; }
    }
    function list() {
        if (!data) return;
        const filtered = filterCases(data.cases, filters, data.today);
        const totalPages = Math.max(1, Math.ceil(filtered.length / 30)); page = Math.min(page, totalPages - 1);
        q('[data-list]').innerHTML = filtered.slice(page * 30, (page + 1) * 30).map((c, index) => `<article class="fu-case ${c.key === selectedKey ? 'selected' : ''}">
            <div class="fu-toolbar"><span class="fu-tag">${topicLabel(c.topic)} · ${dateLabel(c.reference)}</span><span class="fu-tag">${escapeHtml(c.status)}</span></div>
            <h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.turma || 'Turma não informada')} · ${escapeHtml(c.reason)}</p>
            <small>${c.lastContact ? `Último contato com a pessoa: ${escapeHtml(new Date(c.lastContact.at).toLocaleString('pt-BR'))} · ${topicLabel(c.lastContact.topic)}` : 'Nenhum contato registrado com esta pessoa.'}</small>
            ${c.nextDate ? `<p>Retomar em ${dateLabel(c.nextDate)}</p>` : ''}
            <button type="button" data-select="${index}">Preparar contato / ver histórico</button></article>`).join('') || '<p class="fu-empty">Nenhuma pendência encontrada com estes filtros.</p>';
        q('[data-list]').querySelectorAll('[data-select]').forEach(button => button.onclick = () => {
            const item = filtered[page * 30 + Number(button.dataset.select)];
            if (isSaving || item.key === selectedKey) return;
            if (draft && item.key !== selectedKey && !window.confirm('Trocar de pessoa descarta a mensagem não salva. Continuar?')) return;
            selectedKey = item.key; detail(item); list();
            q('[data-detail]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        q('[data-pages]').innerHTML = `<button type="button" data-prev ${page === 0 ? 'disabled' : ''}>Anterior</button><span>${filtered.length} registros · página ${page + 1} de ${totalPages}</span><button type="button" data-next ${page + 1 >= totalPages ? 'disabled' : ''}>Próxima</button>`;
        q('[data-prev]').onclick = () => { page--; list(); };
        q('[data-next]').onclick = () => { page++; list(); };
    }
    function historyMarkup(entries) {
        return entries.slice(0, 100).map(h => `<article><strong>${escapeHtml(h.name)} · ${topicLabel(h.topic)} · ${dateLabel(h.reference)}</strong>
            <p>${escapeHtml(new Date(h.at).toLocaleString('pt-BR'))} · ${h.type === 'contato' ? 'Contato confirmado pelo administrador' : 'Atualização de acompanhamento'} · ${escapeHtml(h.status)}${h.nextDate ? ` · retomar ${dateLabel(h.nextDate)}` : ''}</p>
            <small>Responsável: ${escapeHtml(h.author)}${h.phone ? ` · telefone: +${escapeHtml(h.phone)}` : ''}</small>
            ${h.message ? `<blockquote>${escapeHtml(h.message)}</blockquote>` : ''}${h.notes ? `<p>Observações: ${escapeHtml(h.notes)}</p>` : ''}</article>`).join('') || '<p>Nenhum registro encontrado.</p>';
    }
    function history() {
        if (!data) return;
        const entries = data.history.filter(h => (!filters.search || normalizeText(`${h.name} ${h.email}`).includes(normalizeText(filters.search))) && (!filters.topic || h.topic === filters.topic));
        q('[data-history]').innerHTML = `<p>Até 100 registros mais recentes. Filtre por nome ou assunto acima.</p>${historyMarkup(entries)}`;
    }
    function detail(item) {
        draft = null; requestId = crypto.randomUUID();
        q('[data-detail]').innerHTML = `<h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.email)} · ${topicLabel(item.topic)} · ${dateLabel(item.reference)}</p>
            <p class="fu-note">${item.phone ? `Destino: +${escapeHtml(item.phone)}. Será usada a conta aberta no seu WhatsApp: confira se é seu número pessoal antes de enviar.` : escapeHtml(item.phoneIssue) + ' Corrija o vínculo e atualize a lista para abrir a conversa.'}</p>
            ${!item.joinedKnown ? '<p class="fu-note">Sem data de ingresso: confira se a pessoa já participava neste período.</p>' : ''}
            <label>Mensagem editável<textarea data-message maxlength="2500" rows="7">${escapeHtml(messageFor(item))}</textarea></label>
            <div class="fu-toolbar"><a class="fu-button" data-whatsapp target="_blank" rel="noopener noreferrer">Abrir no meu WhatsApp</a><button type="button" data-copy>Copiar mensagem</button></div>
            <p class="fu-note">Abrir ou copiar não registra envio. O sistema não lê sua conversa nem envia automaticamente.</p>
            <label>Situação após o contato<select data-status>${['Aguardando resposta', 'Retomar', 'Resolvido', 'Pendente'].map(s => `<option ${s === (item.status === 'Pendente' ? 'Aguardando resposta' : item.status) ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label data-next-label>Retomar em<input data-next-date type="date" min="${data.today}" value="${item.nextDate || ''}"></label>
            <label>Observações internas<textarea data-notes maxlength="2000" rows="3" placeholder="Ex.: informou que enviará o comprovante amanhã"></textarea></label>
            <label class="fu-check"><input type="checkbox" data-confirm> Confirmo que realizei este contato e que o texto acima corresponde à mensagem enviada.</label>
            <div class="fu-toolbar"><button type="button" data-save-contact disabled>Registrar contato realizado</button><button type="button" data-save-status>Salvar só a situação / observação</button></div>
            <p data-detail-feedback role="status" aria-live="polite"></p><h4>Histórico desta pessoa</h4>${historyMarkup(data.history.filter(h => h.email === item.email))}`;
        const feedback = text => { const el = q('[data-detail-feedback]'); if (el) el.textContent = text; else flash(text); };
        const updateLink = () => {
            const link = q('[data-whatsapp]'), url = whatsappLink(item.phone, q('[data-message]').value);
            if (url) link.href = url; else link.removeAttribute('href');
            link.setAttribute('aria-disabled', String(!url));
        };
        updateLink();
        q('[data-message]').oninput = () => { draft = true; q('[data-confirm]').checked = false; q('[data-save-contact]').disabled = true; updateLink(); };
        q('[data-whatsapp]').onclick = e => {
            if (!q('[data-whatsapp]').hasAttribute('href')) { e.preventDefault(); return; }
            draft = true; feedback('Conversa aberta. Após enviar, confirme o contato abaixo.');
        };
        q('[data-copy]').onclick = async () => {
            try { await navigator.clipboard.writeText(q('[data-message]').value); feedback('Mensagem copiada. Ainda não foi registrado contato.'); }
            catch { feedback('Não foi possível copiar. Selecione o texto da mensagem e copie.'); }
        };
        q('[data-confirm]').onchange = e => { q('[data-save-contact]').disabled = !e.target.checked || isSaving; };
        const nextVisibility = () => { q('[data-next-label]').hidden = q('[data-status]').value !== 'Retomar'; };
        nextVisibility();
        q('[data-status]').onchange = () => { draft = true; nextVisibility(); };
        q('[data-notes]').oninput = q('[data-next-date]').onchange = () => { draft = true; };
        async function save(type) {
            if (isSaving) return;
            if (type === 'contato' && !q('[data-confirm]').checked) return;
            const payload = { adminEmail: email, id: requestId, email: item.email, topic: item.topic, reference: item.reference,
                type, status: q('[data-status]').value, nextDate: q('[data-next-date]').value,
                message: q('[data-message]').value, notes: q('[data-notes]').value, phone: item.phone, confirmed: q('[data-confirm]').checked };
            if (payload.status === 'Retomar' && (!payload.nextDate || payload.nextDate < data.today)) { feedback('Escolha hoje ou uma data futura para retomar.'); return; }
            isSaving = true;
            const buttons = [...q('[data-detail]').querySelectorAll('button, input, textarea, select')]; buttons.forEach(b => b.disabled = true);
            feedback('Salvando registro…');
            try {
                await api('saveFollowupEvent', { method: 'POST', data: payload });
                draft = null;
                await refresh();
                feedback(type === 'contato' ? 'Contato registrado por sua confirmação. Nenhum envio automático.' : 'Situação salva. Nenhum contato foi marcado como realizado.');
            } catch (error) { feedback(error.message + ' Seu texto foi preservado. Tente salvar novamente.'); }
            finally { isSaving = false; buttons.forEach(b => b.disabled = false); if (q('[data-save-contact]')) q('[data-save-contact]').disabled = !q('[data-confirm]').checked; }
        }
        q('[data-save-contact]').onclick = () => save('contato');
        q('[data-save-status]').onclick = () => save('atualizacao');
    }
    shell();
    refresh();
}
