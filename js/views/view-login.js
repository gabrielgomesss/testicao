// js/views/view-login.js

export const ViewLogin = {
    template: `
        <div class="login-container">
            <div class="login-header">
                <img src="https://static.wixstatic.com/media/509182_e9191147e35c4fa8b2dc37d126710571~mv2.png/v1/fill/w_436,h_86,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Logotipo%20-%20Berimbela%20Chiteroicao%20-%20Edit%20copiar%202.png" style="width:90%;">
                <p class="brand-subtitle">Simulador SDEA</p>
            </div>

            <form id="form-login" class="login-form">
                <div class="input-group">
                    <label for="login-username">Usuário (E-mail)</label>
                    <input type="email" id="login-username" class="input-field" placeholder="exemplo@piloto.com" required autocomplete="username">
                </div>

                <div class="input-group">
                    <label for="login-password">Senha</label>
                    <input type="password" id="login-password" class="input-field" placeholder="••••••••" required autocomplete="current-password">
                </div>

                <button type="submit" class="btn-primary" id="btn-entrar">Acessar</button>
            </form>

            <div id="login-offline-hint" style="display:none; margin: 12px auto 0 auto; max-width: 320px; color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center;">
                Modo offline detectado. O acesso será liberado somente se este dispositivo tiver uma sessão válida sincronizada nas últimas 24h.
            </div>

            <div class="login-footer">
                <button id="link-esqueci-senha" class="btn-link" type="button">Esqueci minha senha</button>
                <p class="register-text">Não tem uma conta? <button id="link-cadastro" class="btn-link text-gold" type="button">Solicitar Acesso</button></p>
            </div>
        </div>

        <div id="modal-recuperar-senha" style="
            display:none;
            position:fixed;
            inset:0;
            z-index:9999;
            background:rgba(0,0,0,.72);
            align-items:center;
            justify-content:center;
            padding:18px;
            box-sizing:border-box;
        ">
            <div style="
                width:100%;
                max-width:420px;
                background:#ffffff;
                color:#0f172a;
                border-radius:16px;
                padding:22px;
                box-shadow:0 20px 60px rgba(0,0,0,.35);
                box-sizing:border-box;
            ">
                <h2 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">Redefinir senha</h2>
                <p style="margin:0 0 18px 0;color:#475569;font-size:14px;line-height:1.5;">
                    Informe o e-mail cadastrado. Enviaremos um link seguro para você criar uma nova senha.
                </p>

                <div style="margin-bottom:16px;">
                    <label for="recuperar-email" style="display:block;font-size:12px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
                        E-mail cadastrado
                    </label>
                    <input
                        id="recuperar-email"
                        type="email"
                        class="input-field"
                        placeholder="exemplo@piloto.com"
                        autocomplete="email"
                        style="width:100%;box-sizing:border-box;color:#0f172a;background:#fff;border:1px solid #cbd5e1;"
                    >
                </div>

                <div id="recuperar-feedback" style="display:none;margin-bottom:14px;font-size:13px;line-height:1.5;"></div>

                <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
                    <button id="btn-cancelar-recuperacao" type="button" style="
                        background:#f1f5f9;
                        color:#334155;
                        border:1px solid #cbd5e1;
                        border-radius:8px;
                        padding:10px 14px;
                        cursor:pointer;
                        font-weight:800;
                    ">Cancelar</button>

                    <button id="btn-enviar-recuperacao" type="button" style="
                        background:#0f172a;
                        color:#fff;
                        border:none;
                        border-radius:8px;
                        padding:10px 14px;
                        cursor:pointer;
                        font-weight:800;
                    ">Enviar link</button>
                </div>
            </div>
        </div>
    `,

    abrirModalRecuperacao() {
        const modal = document.getElementById('modal-recuperar-senha');
        const emailLogin = document.getElementById('login-username')?.value?.trim() || '';
        const emailRecuperar = document.getElementById('recuperar-email');
        const feedback = document.getElementById('recuperar-feedback');

        if (emailRecuperar) {
            emailRecuperar.value = emailLogin;
        }

        if (feedback) {
            feedback.style.display = 'none';
            feedback.innerText = '';
        }

        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => emailRecuperar?.focus(), 50);
        }
    },

    fecharModalRecuperacao() {
        const modal = document.getElementById('modal-recuperar-senha');
        const feedback = document.getElementById('recuperar-feedback');

        if (feedback) {
            feedback.style.display = 'none';
            feedback.innerText = '';
        }

        if (modal) {
            modal.style.display = 'none';
        }
    },

    mostrarFeedbackRecuperacao(mensagem, tipo = 'info') {
        const feedback = document.getElementById('recuperar-feedback');

        if (!feedback) return;

        const cores = {
            sucesso: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
            erro: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
            info: { bg: '#e0f2fe', color: '#075985', border: '#bae6fd' }
        };

        const cor = cores[tipo] || cores.info;

        feedback.style.display = 'block';
        feedback.style.background = cor.bg;
        feedback.style.color = cor.color;
        feedback.style.border = `1px solid ${cor.border}`;
        feedback.style.borderRadius = '10px';
        feedback.style.padding = '10px';
        feedback.innerText = mensagem;
    },

    init(callbacks) {
        const form = document.getElementById('form-login');
        const hintOffline = document.getElementById('login-offline-hint');

        const atualizarHintOffline = () => {
            if (hintOffline) {
                hintOffline.style.display = navigator.onLine ? 'none' : 'block';
            }
        };

        atualizarHintOffline();
        window.addEventListener('online', atualizarHintOffline, { once: false });
        window.addEventListener('offline', atualizarHintOffline, { once: false });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const btnEntrar = document.getElementById('btn-entrar');

            if (btnEntrar) {
                btnEntrar.disabled = true;
                btnEntrar.innerText = navigator.onLine ? 'Validando...' : 'Validando cache...';
            }

            callbacks.onLogin?.(username, password);
        });

        document.getElementById('link-esqueci-senha')?.addEventListener('click', () => {
            if (!navigator.onLine) {
                alert('A redefinição de senha precisa de conexão com a internet.');
                return;
            }

            this.abrirModalRecuperacao();
        });

        document.getElementById('btn-cancelar-recuperacao')?.addEventListener('click', () => {
            this.fecharModalRecuperacao();
        });

        document.getElementById('modal-recuperar-senha')?.addEventListener('click', (event) => {
            if (event.target?.id === 'modal-recuperar-senha') {
                this.fecharModalRecuperacao();
            }
        });

        document.getElementById('btn-enviar-recuperacao')?.addEventListener('click', async () => {
            const email = document.getElementById('recuperar-email')?.value?.trim().toLowerCase() || '';
            const btn = document.getElementById('btn-enviar-recuperacao');

            if (!email) {
                this.mostrarFeedbackRecuperacao('Informe um e-mail válido.', 'erro');
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Enviando...';
            }

            try {
                const resultado = await callbacks.onForgotPassword?.(email);

                if (resultado?.sucesso) {
                    this.mostrarFeedbackRecuperacao(resultado.mensagem || 'Link enviado com sucesso. Verifique seu e-mail.', 'sucesso');
                } else {
                    this.mostrarFeedbackRecuperacao(resultado?.erro || 'Não foi possível enviar o link. Tente novamente.', 'erro');
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Enviar link';
                }
            }
        });

        document.getElementById('link-cadastro')?.addEventListener('click', () => callbacks.onNavigateToRegister?.());
    }
};
