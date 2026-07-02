// js/views/view-cadastro.js

/**
 * Renderiza a interface de Cadastro e gerencia as solicitações de acesso
 */
export const ViewCadastro = {
    // 1. O Template HTML injetado dinamicamente
    template: `
        <div class="login-container">
            <div class="login-header">
                <h1 class="brand-title">SOLICITAR ACESSO</h1>
                <p class="brand-subtitle">Crie seu perfil de treinamento</p>
            </div>

            <form id="form-cadastro" class="login-form">
                <div class="input-group">
                    <label for="cadastro-username">E-mail (Será seu Usuário)</label>
                    <input type="email" id="cadastro-username" class="input-field" placeholder="exemplo@piloto.com" required autocomplete="username">
                </div>

                <div class="input-group">
                    <label for="cadastro-password">Senha</label>
                    <input 
                        type="password" 
                        id="cadastro-password" 
                        class="input-field" 
                        placeholder="Ex: Piloto@123" 
                        required 
                        minlength="6" 
                        autocomplete="new-password"
                        aria-describedby="password-rules"
                    >

                    <div id="password-rules" class="password-rules" style="
                        margin-top: 10px;
                        padding: 12px;
                        border-radius: 10px;
                        background: rgba(255, 255, 255, 0.08);
                        border: 1px solid rgba(255, 255, 255, 0.16);
                        color: #ffffff;
                        font-size: 12px;
                        line-height: 1.45;
                    ">
                        <div style="
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: .7px;
                            margin-bottom: 8px;
                            color: #e6edf7;
                            font-size: 11px;
                        ">
                            Requisitos da senha
                        </div>

                        <div class="password-rule" data-rule="length" style="display:flex;align-items:center;gap:8px;margin:5px 0;color:#cbd5e1;">
                            <span class="rule-icon">○</span>
                            <span>Mínimo de 6 caracteres</span>
                        </div>

                        <div class="password-rule" data-rule="uppercase" style="display:flex;align-items:center;gap:8px;margin:5px 0;color:#cbd5e1;">
                            <span class="rule-icon">○</span>
                            <span>Uma letra maiúscula (A-Z)</span>
                        </div>

                        <div class="password-rule" data-rule="lowercase" style="display:flex;align-items:center;gap:8px;margin:5px 0;color:#cbd5e1;">
                            <span class="rule-icon">○</span>
                            <span>Uma letra minúscula (a-z)</span>
                        </div>

                        <div class="password-rule" data-rule="number" style="display:flex;align-items:center;gap:8px;margin:5px 0;color:#cbd5e1;">
                            <span class="rule-icon">○</span>
                            <span>Um número (0-9)</span>
                        </div>

                        <div class="password-rule" data-rule="special" style="display:flex;align-items:center;gap:8px;margin:5px 0;color:#cbd5e1;">
                            <span class="rule-icon">○</span>
                            <span>Um caractere especial (!@#$%)</span>
                        </div>
                    </div>
                </div>

                <div class="input-group">
                    <label for="cadastro-curso">Curso Ativo</label>
                    <select id="cadastro-curso" class="input-field select-field" required>
                        <option value="" disabled selected>Selecione seu curso...</option>
                        <option value="Step Climb">Step Climb</option>
                        <option value="Fast Track">Fast Track</option>
                    </select>
                </div>

                <button type="submit" class="btn-primary" id="btn-cadastrar">Enviar Solicitação</button>
            </form>

            <div class="login-footer">
                <p class="register-text">Já tem cadastro? <button id="link-voltar-login" class="btn-link text-gold">Voltar ao Login</button></p>
            </div>
        </div>
    `,

    validarSenha(password) {
        return {
            length: password.length >= 6,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };
    },

    senhaAtendeRequisitos(password) {
        const regras = this.validarSenha(password);
        return Object.values(regras).every(Boolean);
    },

    atualizarIndicadoresSenha(password) {
        const regras = this.validarSenha(password);

        Object.entries(regras).forEach(([regra, valida]) => {
            const item = document.querySelector(`.password-rule[data-rule="${regra}"]`);
            if (!item) return;

            const icon = item.querySelector('.rule-icon');
            item.style.color = valida ? '#22c55e' : '#cbd5e1';
            item.style.fontWeight = valida ? '800' : '500';

            if (icon) {
                icon.textContent = valida ? '✓' : '○';
                icon.style.color = valida ? '#22c55e' : '#94a3b8';
                icon.style.fontWeight = '900';
            }
        });
    },

    mensagemErroSenha() {
        return [
            'Sua senha deve conter:',
            '',
            '• Mínimo de 6 caracteres',
            '• Uma letra maiúscula (A-Z)',
            '• Uma letra minúscula (a-z)',
            '• Um número (0-9)',
            '• Um caractere especial (!@#$%)'
        ].join('\n');
    },

    /**
     * Inicializa os ouvintes de eventos da tela de cadastro
     * @param {Object} callbacks - Funções externas de navegação e lógica enviadas pelo app.js
     */
    init(callbacks) {
        const form = document.getElementById('form-cadastro');
        const linkVoltar = document.getElementById('link-voltar-login');
        const inputSenha = document.getElementById('cadastro-password');

        if (inputSenha) {
            this.atualizarIndicadoresSenha(inputSenha.value || '');

            inputSenha.addEventListener('input', () => {
                this.atualizarIndicadoresSenha(inputSenha.value || '');
            });
        }

        // Gatilho do Formulário de Cadastro
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = document.getElementById('cadastro-username').value.trim();
            const password = document.getElementById('cadastro-password').value;
            const curso = document.getElementById('cadastro-curso').value;

            if (!this.senhaAtendeRequisitos(password)) {
                this.atualizarIndicadoresSenha(password);
                alert(this.mensagemErroSenha());
                return;
            }

            // Passa os dados estruturados para o módulo auth.js registrar no Firebase
            if (callbacks.onRegister) {
                callbacks.onRegister(email, password, curso);
            }
        });

        // Gatilho para voltar à tela de login
        linkVoltar.addEventListener('click', () => {
            if (callbacks.onNavigateToLogin) {
                callbacks.onNavigateToLogin();
            }
        });
    }
};
