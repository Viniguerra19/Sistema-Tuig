import { apiFetch, normalizeText } from './utils.js';
import './followup.css';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateLabel = value => value?.split('-').reverse().join('/') || '—';
const monthLabel = value => {
    const [year, month] = value.split('-');
    return `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(month) - 1]}/${year}`;
};
const referenceLabel = (value, topic) => topic === 'mensalidade' ? monthLabel(value) : dateLabel(value);
const topicLabel = topic => topic === 'mensalidade' ? 'Mensalidade' : 'Presença';
export function messageFor(item) {
    const first = item.name.trim().split(/\s+/)[0] || 'tudo bem';
    const references = item.references || [item.reference];
    const dates = references.map(value => referenceLabel(value, item.topic)).join(', ');
    return item.topic === 'mensalidade'
        ? `Oi, ${first}! Tudo bem? Estou conferindo as mensalidades do terreiro e não encontrei o pagamento referente a ${dates}. Você consegue me confirmar se já realizou o pagamento? Se já enviou o comprovante, me avise para eu conferir. Obrigado!`
        : `Oi, ${first}! Tudo bem com você? Não encontrei sua presença registrada no terreiro ${references.length > 1 ? 'nas datas' : 'em'} ${dates}. Você esteve lá e esqueceu de marcar, ou não conseguiu participar? Queria saber se está tudo bem e se podemos ajudar.`;
}
export function whatsappLink(phone, message) {
    return /^[1-9]\d{6,14}$/.test(phone) && message.trim() ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}
export function filterCases(cases, filters, today) {
    return cases.filter(c => (!filters.search || normalizeText(`${c.name} ${c.email} ${c.phone}`).includes(normalizeText(filters.search)))
        && (!filters.turma || c.turma === filters.turma)
        && (!filters.topic || c.topic === filters.topic)
        && (!filters.status || filters.status === 'all' || (filters.status === 'open' ? c.status !== 'Resolvido'
            : filters.status === 'due' ? c.status === 'Retomar' && c.nextDate <= today : c.status === filters.status)));
}
export function groupCases(cases) {
    const groups = new Map();
    cases.forEach(item => {
        const key = JSON.stringify([item.email, item.topic]);
        if (!groups.has(key)) groups.set(key, { ...item, references: [] });
        const references = groups.get(key).references;
        if (!references.includes(item.reference)) references.push(item.reference);
    });
    return [...groups.values()];
}

export function renderFollowupCenter(root, email) {
    root.dataset.ready = 'true';
    let data, page = 0, loading = false;
    const now = new Date(), previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const begin = new Date(now); begin.setDate(begin.getDate() - 30);
    const filters = { search: '', turma: '', topic: '', from: localDay(begin), to: localDay(now), monthFrom: `${previous.getFullYear()}-01`, month: localDay(previous).slice(0, 7) };
    const q = selector => root.querySelector(selector);
    root.innerHTML = `<div class="fu"><header><h2>Acompanhamento</h2><p>Mensalidades e presenças para conferir. Abra o WhatsApp da pessoa com a mensagem pronta.</p></header>
        <div class="fu-summary" data-summary></div>
        <form class="fu-filters">
            <label>Buscar pessoa<input name="search" placeholder="Nome, e-mail ou telefone" type="search"></label>
            <label>Turma<select name="turma"><option value="">Todas</option></select></label>
            <label>Assunto<select name="topic"><option value="">Todos</option><option value="presenca">Presença</option><option value="mensalidade">Mensalidade</option></select></label>
            <details class="fu-period"><summary>Alterar período</summary><div class="fu-period-fields">
                <label>Presenças: de<input type="date" name="from" value="${filters.from}" required></label>
                <label>Até<input type="date" name="to" value="${filters.to}" required></label>
                <label data-month-from-label>Mensalidades: de<input type="month" name="monthFrom" value="${filters.monthFrom}" max="${filters.month}" required></label>
                <label data-month-label>Até<input type="month" name="month" value="${filters.month}" max="${localDay(previous).slice(0, 7)}" required></label>
                <button type="submit">Atualizar</button>
            </div></details>
        </form>
        <p class="fu-period-label" data-period></p>
        <p data-feedback role="status" aria-live="polite"></p>
        <div data-list></div><div class="fu-toolbar" data-pages></div>
        <p class="fu-note">Confira o cadastro antes de contatar: a ausência de registro precisa ser conferida. O telefone vem da coluna O (WhatsApp) da aba Usuários; cadastre-o com país e DDD, por exemplo +55 11 99999-9999.</p>
    </div>`;
    q('.fu-filters').onsubmit = e => {
        e.preventDefault();
        if (loading) return;
        ['from', 'to', 'monthFrom', 'month'].forEach(k => filters[k] = q(`[name=${k}]`).value);
        refresh();
    };
    ['search', 'turma', 'topic'].forEach(k => q(`[name=${k}]`).addEventListener(k === 'search' ? 'input' : 'change', e => {
        filters[k] = e.target.value; page = 0; list();
    }));
    async function refresh() {
        loading = true;
        q('[data-feedback]').textContent = 'Carregando acompanhamento…';
        q('[type=submit]').disabled = true;
        try {
            const result = await apiFetch('getFollowupData', { params: { adminEmail: email, from: filters.from, to: filters.to, monthFrom: filters.monthFrom, month: filters.month } });
            if (result.status !== 'success') throw new Error(result.message || 'Não foi possível carregar.');
            data = result.data; page = 0;
            q('[data-month-label]').hidden = !data.isMaster;
            q('[data-month-from-label]').hidden = !data.isMaster;
            q('[name=topic] option[value=mensalidade]').hidden = !data.isMaster;
            if (!data.isMaster && filters.topic === 'mensalidade') filters.topic = q('[name=topic]').value = '';
            q('[name=turma]').innerHTML = '<option value="">Todas</option>' + [...new Set(data.cases.map(c => c.turma))].filter(Boolean).sort().map(t => `<option>${escapeHtml(t)}</option>`).join('');
            q('[name=turma]').value = filters.turma;
            if (!q('[name=turma]').value) filters.turma = '';
            q('[data-period]').textContent = `Presenças: ${dateLabel(filters.from)} a ${dateLabel(filters.to)}` + (data.isMaster ? ` · Mensalidades: ${monthLabel(filters.monthFrom)} a ${monthLabel(filters.month)}` : '');
            const grouped = groupCases(data.cases);
            q('[data-summary]').innerHTML = [
                ...(data.isMaster ? [[grouped.filter(c => c.topic === 'mensalidade').length, 'pessoas com mensalidade a conferir']] : []),
                [grouped.filter(c => c.topic === 'presenca').length, 'pessoas com presença a conferir']
            ].map(([n, title]) => `<div><strong>${n}</strong><span>${title}</span></div>`).join('');
            list();
            q('[data-feedback]').textContent = '';
        } catch (error) {
            q('[data-feedback]').textContent = error.message + ' Não foi possível atualizar os dados.';
        } finally { loading = false; q('[type=submit]').disabled = false; }
    }
    function list() {
        if (!data) return;
        const filtered = groupCases(filterCases(data.cases, filters, data.today));
        const totalPages = Math.max(1, Math.ceil(filtered.length / 30)); page = Math.min(page, totalPages - 1);
        q('[data-list]').innerHTML = filtered.slice(page * 30, (page + 1) * 30).map(c => {
            const url = whatsappLink(c.phone, messageFor(c));
            return `<article class="fu-case">
                <div class="fu-person"><h3>${escapeHtml(c.name)}</h3><small>${escapeHtml(c.turma || 'Turma não informada')}</small>
                    <p><span class="fu-tag">${topicLabel(c.topic)}</span> ${escapeHtml(c.references.map(value => referenceLabel(value, c.topic)).join(', '))}</p></div>
                <div class="fu-contact"><span class="fu-phone">${c.phone ? '+' + escapeHtml(c.phone) : 'Telefone não cadastrado'}</span>
                    ${url ? `<a class="fu-button" data-whatsapp href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>` : `<button type="button" disabled>Abrir no WhatsApp</button><small>${escapeHtml(c.phoneIssue || 'Cadastre o telefone na coluna O (WhatsApp) da aba Usuários.')}</small>`}
                </div></article>`;
        }).join('') || '<p class="fu-empty">Nenhuma pendência encontrada com estes filtros.</p>';
        q('[data-pages]').innerHTML = totalPages > 1 ? `<button type="button" data-prev ${page === 0 ? 'disabled' : ''}>Anterior</button><span>${filtered.length} registros · página ${page + 1} de ${totalPages}</span><button type="button" data-next ${page + 1 >= totalPages ? 'disabled' : ''}>Próxima</button>` : '';
        if (q('[data-prev]')) q('[data-prev]').onclick = () => { page--; list(); };
        if (q('[data-next]')) q('[data-next]').onclick = () => { page++; list(); };
    }
    refresh();
}
