import { API_URL } from './config.js';
import { renderAdminDashboard } from './admin.js';
import { renderStudentDashboard } from './student.js';

import './style.css'; // Importa estilos via Vite

// Inicialização do Web App

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  const savedEmail = localStorage.getItem('tuig_email');
  if (savedEmail) {
    console.log("Auto-login: Verificado e-mail salvo", savedEmail);
    await login(savedEmail);
  } else {
    renderLogin();
  }
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
        <header style="margin-bottom: 48px; text-align: center;">
            <h1 style="font-size: 2.8rem; font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">Sistema TUIG</h1>
            <p style="color: var(--text-muted); font-size: 1.1rem; margin-top: 12px; font-weight: 400;">Seja bem-vindo. Digite seu e-mail para acessar.</p>
        </header>

        <div id="login-form" style="background: var(--glass-bg); padding: 32px; border-radius: 24px; border: 1px solid var(--glass-border); box-shadow: var(--premium-shadow); position: relative; overflow: hidden;">
            <div style="position: absolute; top:0; left:0; right:0; height:4px; background: linear-gradient(90deg, var(--primary), var(--accent));"></div>
            
            <input type="email" id="email-input" placeholder="seuemail@exemplo.com" style="width: 100%; border-radius: 14px; padding: 18px 20px; font-size: 1.05rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; outline: none; transition: all 0.3s;" onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(99, 102, 241, 0.2)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none';">

            <div id="login-button-container" style="margin-top: 24px;">
                <button id="btn-login" style="width: 100%; padding: 16px; font-size: 1.1rem; border-radius: 14px; display: flex; justify-content: center; align-items: center; gap: 10px; box-shadow: var(--glow-shadow);">Entrar no Sistema</button>
            </div>

            <div class="loader" id="loader"></div>
            <div id="error-msg" style="color: #f87171; margin-top: 20px; text-align: center; font-size: 0.95rem; font-weight: 500;"></div>
        </div>
    `;

  document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('email-input').value.trim();
    login(email);
  });

  document.getElementById('email-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const email = document.getElementById('email-input').value.trim();
      login(email);
    }
  });
}

async function login(email) {
  if (!email) {
    const errorMsg = document.getElementById('error-msg');
    if (errorMsg) errorMsg.innerText = "Por favor, digite seu e-mail.";
    return;
  }

  const errorMsg = document.getElementById('error-msg');
  const loader = document.getElementById('loader');
  const btnContainer = document.getElementById('login-button-container');

  if (errorMsg) errorMsg.innerText = "";
  if (loader) loader.classList.add('active');
  if (btnContainer) btnContainer.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}?action=login&email=${encodeURIComponent(email)}`, {
      redirect: 'follow',
      headers: { 'Accept': 'application/json' }
    });

    const text = await res.text();
    console.log("Resposta bruta do servidor:", text.substring(0, 200));

    let json;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.error("Resposta não é JSON válido:", text.substring(0, 300));
      handleLoginError("Servidor retornou resposta inválida. Tente novamente.");
      return;
    }

    if (json.status === "success") {
      const userRole = json.data ? json.data.role : json.role; // Suporta tanto o formato antigo quanto o novo

      localStorage.setItem('tuig_email', email);
      localStorage.setItem('tuig_role', userRole);

      // Associa o e-mail do usuário ao OneSignal para envio de Push segmentado
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function (OneSignal) {
          await OneSignal.login(email);
        });
      }

      const emailClean = email.toLowerCase().trim();
      const isAllowedSpecial = emailClean === "andreiaandy07@gmail.com" || emailClean === "albertofit7@gmail.com";

      if (userRole === "master_admin" || userRole === "admin" || isAllowedSpecial) {
        await renderAdminDashboard(email);
      } else {
        await renderStudentDashboard(email);
      }
    } else {
      handleLoginError(json.message);
    }
  } catch (e) {
    console.error("Erro no login:", e);
    handleLoginError("Erro na conexão com o servidor.");
  }
}

function handleLoginError(msg) {
  localStorage.removeItem('tuig_email');
  localStorage.removeItem('tuig_role');
  const app = document.getElementById('app');

  // Se o login falhar durante o auto-login, a tela pode estar em branco, então recarregamos o form
  if (!document.getElementById('login-form')) {
    renderLogin();
  }

  const loader = document.getElementById('loader');
  const errorMsg = document.getElementById('error-msg');
  const btnContainer = document.getElementById('login-button-container');

  if (loader) loader.classList.remove('active');
  if (errorMsg) errorMsg.innerText = msg;
  if (btnContainer) btnContainer.classList.remove('hidden');
}
