import { apiFetch } from './utils.js';
import './membership.css';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
async function call(action, data) {
    const result = await apiFetch(action, { method: 'POST', data, timeout: 120000 });
    if (result.status !== 'success') throw new Error(result.message || 'Não foi possível concluir.');
    return result.data;
}
async function confirmAction(root, data, finished) {
    const panel = document.createElement('div');
    panel.className = 'membership-confirm';
    panel.innerHTML = '<p data-instruction>Solicitando código de confirmação…</p><form><label hidden>Código de confirmação<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></label><div class="membership-actions"><button type="submit" hidden>Confirmar operação</button><button type="button" data-cancel>Cancelar</button></div><p role="status" aria-live="polite"></p></form>';
    root.append(panel);
    const status = panel.querySelector('[role=status]');
    panel.querySelector('[data-cancel]').onclick = () => panel.remove();
    try {
        const challenge = await call('membershipChallenge', data);
        panel.querySelector('[data-instruction]').textContent = 'Enviamos um código ao seu e-mail. Digite abaixo para confirmar. Ele vale por dez minutos.';
        panel.querySelector('label').hidden = false;
        panel.querySelector('[type=submit]').hidden = false;
        panel.querySelector('form').onsubmit = async event => {
            event.preventDefault();
            const button = panel.querySelector('button'); button.disabled = true;
            status.textContent = 'Processando…';
            try {
                const result = await call('membershipConfirm', { ...data, challenge: challenge.id, code: panel.querySelector('input').value.trim() });
                panel.remove(); await finished(result);
            } catch (error) { status.textContent = error.message; }
            finally { button.disabled = false; }
        };
    } catch (error) { panel.querySelector('[data-instruction]').textContent = 'Não foi possível iniciar esta operação.'; status.textContent = error.message.replace(/^Error:\s*/, ''); panel.querySelector('[type=submit]').disabled = true; }
}
export function renderMembershipSelf(root, email) {
    root.classList.add('membership');
    root.innerHTML = '<details class="card"><summary>Meu vínculo com o terreiro</summary><p>O afastamento bloqueia seu acesso e mantém o histórico para um possível retorno. A exclusão definitiva apaga os dados e anexos vinculados após conferência da administração.</p><div class="membership-actions"><button data-away>Solicitar afastamento</button><button data-delete>Solicitar exclusão definitiva dos meus dados</button></div><p role="status"></p><div data-confirm></div></details>';
    const request = operation => {
        if (!window.confirm(operation === 'requestDeletion' ? 'Solicitar a exclusão definitiva? Seu acesso será bloqueado após confirmar o código. A administração receberá o pedido para conferência.' : 'Confirmar seu afastamento? Seu acesso será bloqueado e o histórico será preservado.')) return;
        root.querySelector('[data-confirm]').replaceChildren();
        confirmAction(root.querySelector('[data-confirm]'), { email, target: email, operation }, () => {
            localStorage.removeItem('tuig_email'); localStorage.removeItem('tuig_role');
            root.querySelector('[role=status]').textContent = 'Pedido registrado. Seu acesso foi encerrado.';
            window.alert('Pedido registrado. Seu acesso foi encerrado.'); window.location.reload();
        });
    };
    root.querySelector('[data-away]').onclick = () => request('away');
    root.querySelector('[data-delete]').onclick = () => request('requestDeletion');
}
export async function renderMembershipAdmin(root, email) {
    root.classList.add('membership');
    root.innerHTML = '<h3>Vínculos e solicitações</h3><p>Carregando…</p>';
    try {
        const members = await call('membershipList', { email });
        root.innerHTML = '<h3>Vínculos e solicitações</h3><label>Buscar por nome ou e-mail<input type="search"></label><div data-list></div><div data-confirm></div><p role="status"></p>';
        const draw = () => {
            const query = root.querySelector('input').value.toLowerCase();
            root.querySelector('[data-list]').innerHTML = members.filter(m => `${m.name} ${m.email}`.toLowerCase().includes(query)).map(m => `<details class="card"><summary>${escape(m.name)} — ${escape(m.status)}</summary><p>${escape(m.email)} · ${escape(m.turma)}</p><p>${escape(m.notes)}</p><label>Observação<input data-note maxlength="1000"></label><button data-op="away" data-email="${escape(m.email)}">Afastar</button> <button data-op="activate" data-email="${escape(m.email)}">Reativar</button> <button data-op="preview" data-email="${escape(m.email)}">Deletar todos os dados</button></details>`).join('');
            root.querySelectorAll('[data-op]').forEach(button => button.onclick = async () => {
                const data = { email, target: button.dataset.email, operation: button.dataset.op, notes: button.closest('details').querySelector('[data-note]').value };
                const area = root.querySelector('[data-confirm]'); area.replaceChildren();
                try {
                    if (data.operation === 'preview') {
                        const plan = await call('membershipPreview', data);
                        area.innerHTML = `<h4>Conferência da exclusão de ${escape(data.target)}</h4><p>${plan.files} anexos no Drive; ${plan.rows} registros em ${plan.sheets.length} abas.</p><ul>${plan.sheets.map(s => `<li>${escape(s.name)}: ${s.count} registros</li>`).join('')}</ul>${plan.issues.length ? `<p>Exclusão bloqueada até resolver:</p><ul>${plan.issues.map(i => `<li>${escape(i)}</li>`).join('')}</ul>` : '<p>A exclusão é definitiva, inclusive dos anexos. Confira a pessoa e as abas antes de continuar.</p><button data-execute>Excluir definitivamente</button>'}`;
                        area.querySelector('[data-execute]')?.addEventListener('click', () => {
                            if (window.prompt('Digite EXCLUIR para confirmar a exclusão definitiva de ' + data.target) !== 'EXCLUIR') return;
                            confirmAction(area, { ...data, operation: 'delete', fingerprint: plan.fingerprint }, () => renderMembershipAdmin(root, email));
                        });
                    } else {
                        await confirmAction(area, data, () => renderMembershipAdmin(root, email));
                    }
                } catch (error) { root.querySelector('[role=status]').textContent = error.message; }
            });
        };
        root.querySelector('input').oninput = draw; draw();
    } catch (error) { root.textContent = error.message; }
}
