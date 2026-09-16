import { apiFetch } from './utils.js';
import './reflection.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = value => new Date(value).toLocaleString('pt-BR');
async function request(action, options) {
    const result = await apiFetch(action, options);
    if (result.status !== 'success') throw new Error(result.message || 'Não foi possível concluir.');
    return result.data;
}
async function showPhoto(container, params) {
    container.textContent = 'Carregando foto…';
    try {
        const result = await request('getReflectionPhoto', { params });
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(result.dataUrl)) throw new Error('Formato de foto inválido.');
        const image = document.createElement('img'); image.src = result.dataUrl; image.alt = 'Respostas manuscritas da reflexão';
        container.replaceChildren(image);
    } catch (error) { container.textContent = error.message; }
}

export async function renderStudentReflection(root, email) {
    root.className = 'reflection';
    root.innerHTML = '<p role="status">Carregando atividade de reflexão…</p>';
    try {
        const data = await request('getReflection', { params: { email } });
        const previous = data.submission;
        root.innerHTML = `<h3>Reflexão · Turma de sábado</h3><p>Crie cinco perguntas sobre o que pode ou não pode ser feito dentro da casa. Numere suas perguntas de 1 a 5 ou envie uma foto do manuscrito.</p>
            <p data-saved role="status">${previous ? `Última entrega: ${escape(date(previous.at))}. Você pode enviar uma nova versão.` : 'Você ainda não enviou esta atividade.'}</p>
            ${previous?.hasPhoto ? '<button type="button" data-view>Ver foto enviada</button><div data-photo></div>' : ''}
            <form><fieldset><legend>Como deseja responder?</legend>
            <label><input type="radio" name="reflection-mode" value="text" checked> Responder na plataforma</label>
            <label><input type="radio" name="reflection-mode" value="photo"> Anexar foto do manuscrito</label></fieldset>
            ${previous?.answers?.length > 1 ? `<details><summary>Entrega anterior (atividade antiga)</summary><p class="reflection-answer">${escape(previous.answers.join('\n\n'))}</p></details>` : ''}
            <div data-text-entry><label for="reflection-answer">Suas cinco perguntas de “pode ou não pode”</label><textarea id="reflection-answer" data-answer rows="10" maxlength="5000" required placeholder="Escreva aqui suas cinco perguntas, numeradas de 1 a 5.">${escape(previous?.answers?.length === 1 ? previous.answers[0] : '')}</textarea></div>
            <div data-upload hidden><label>Foto das perguntas (JPG, PNG ou WEBP, até 4 MB)<input data-file type="file" accept="image/jpeg,image/png,image/webp"></label><p>Fotografe a folha inteira com boa iluminação e confira se as cinco perguntas estão legíveis.</p><div data-preview></div></div>
            <button type="submit">${previous ? 'Enviar nova versão' : 'Enviar pergunta'}</button><p data-feedback role="status" aria-live="polite"></p></form>`;
        const form = root.querySelector('form'), feedback = root.querySelector('[data-feedback]');
        const fileInput = root.querySelector('[data-file]');
        let imageUrl = '', submissionId = crypto.randomUUID(), pending = null;
        const mode = () => form.querySelector('input[type=radio]:checked').value;
        form.querySelectorAll('input[type=radio]').forEach(input => input.onchange = () => {
            const isPhoto = mode() === 'photo';
            root.querySelector('[data-text-entry]').hidden = isPhoto;
            root.querySelectorAll('[data-answer]').forEach(t => { t.hidden = isPhoto; t.required = !isPhoto; });
            root.querySelector('[data-upload]').hidden = !isPhoto; fileInput.required = isPhoto;
        });
        fileInput.onchange = () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
            const preview = root.querySelector('[data-preview]'); preview.replaceChildren();
            const file = fileInput.files[0];
            if (file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 4 * 1024 * 1024) {
                const img = document.createElement('img'); imageUrl = URL.createObjectURL(file); img.src = imageUrl; img.alt = 'Prévia da foto selecionada'; preview.append(img);
            }
        };
        root.querySelector('[data-view]')?.addEventListener('click', () => showPhoto(root.querySelector('[data-photo]'), { email, id: previous.id }));
        form.onsubmit = async event => {
            event.preventDefault();
            if (form.dataset.busy) return;
            form.dataset.busy = 'true';
            const controls = [...form.querySelectorAll('input, textarea, button')];
            controls.forEach(el => el.disabled = true); feedback.textContent = 'Enviando reflexão…';
            try {
                if (!pending) {
                    pending = { email, id: submissionId, mode: mode() };
                    if (pending.mode === 'text') pending.answers = [...root.querySelectorAll('[data-answer]')].map(el => el.value.trim());
                    else {
                        const file = fileInput.files[0];
                        if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) throw new Error('Selecione uma foto JPG, PNG ou WEBP de até 4 MB.');
                        pending.photo = await new Promise((resolve, reject) => {
                            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(file);
                        });
                    }
                }
                const saved = await request('saveReflection', { method: 'POST', data: pending, timeout: 60000 });
                pending = null; submissionId = crypto.randomUUID();
                if (imageUrl) URL.revokeObjectURL(imageUrl);
                await renderStudentReflection(root, email);
                root.querySelector('[data-saved]').textContent = `Reflexão enviada com sucesso em ${date(saved.at)}.`;
            } catch (error) {
                feedback.textContent = error.message + ' Suas respostas continuam aqui.';
                // Em resposta incerta, repetir o mesmo envio evita duplicação.
                if (!(error instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(error.name)) pending = null;
            } finally { delete form.dataset.busy; controls.forEach(el => el.disabled = false); }
        };
    } catch (error) {
        root.replaceChildren(); const p = document.createElement('p'); p.textContent = error.message; root.append(p);
        const retry = document.createElement('button'); retry.textContent = 'Tentar novamente'; retry.onclick = () => renderStudentReflection(root, email); root.append(retry);
    }
}

export async function renderAdminReflections(root, adminEmail) {
    root.className = 'reflection'; root.innerHTML = '<p role="status">Carregando reflexões da turma de sábado…</p>';
    try {
        const data = await request('getReflections', { params: { adminEmail } });
        const count = data.students.filter(s => s.submission).length;
        root.innerHTML = `<h3>Reflexões · Turma de sábado</h3><p>${count} de ${data.students.length} alunos enviaram a atividade.</p>
            <button data-refresh>Atualizar entregas</button><label>Buscar aluno<input data-search type="search" placeholder="Nome ou e-mail"></label>
            <label>Situação<select data-filter><option value="all">Todos</option><option value="sent">Enviaram</option><option value="pending">Ainda não enviaram</option></select></label><div data-list></div>`;
        const draw = () => {
            const search = root.querySelector('[data-search]').value.toLocaleLowerCase('pt-BR'), filter = root.querySelector('[data-filter]').value;
            const students = data.students.filter(s => `${s.name} ${s.email}`.toLocaleLowerCase('pt-BR').includes(search) && (filter === 'all' || (filter === 'sent' ? !!s.submission : !s.submission)));
            root.querySelector('[data-list]').innerHTML = students.map(s => `<details><summary>${escape(s.name)} — ${s.submission ? `Enviado em ${escape(date(s.submission.at))}` : 'Ainda não enviou'}</summary><p>${escape(s.email)}</p>${s.submission ? s.submission.mode === 'text' ? `<strong>${s.submission.answers.length > 1 ? 'Entrega anterior (atividade antiga)' : 'Perguntas criadas pelo aluno'}</strong><p class="reflection-answer">${escape(s.submission.answers.join('\n\n'))}</p>` : `<button data-image="${escape(s.submission.id)}">Ver foto do manuscrito</button><div data-photo></div>` : ''}</details>`).join('') || '<p>Nenhum aluno encontrado.</p>';
            root.querySelectorAll('[data-image]').forEach(button => button.onclick = () => showPhoto(button.nextElementSibling, { adminEmail, id: button.dataset.image }));
        };
        root.querySelector('[data-search]').oninput = draw; root.querySelector('[data-filter]').onchange = draw;
        root.querySelector('[data-refresh]').onclick = () => renderAdminReflections(root, adminEmail); draw();
    } catch (error) { root.textContent = error.message; const button = document.createElement('button'); button.textContent = 'Tentar novamente'; button.onclick = () => renderAdminReflections(root, adminEmail); root.append(button); }
}
