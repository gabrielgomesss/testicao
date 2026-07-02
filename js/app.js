// js/app.js

// 1. Importações das interfaces visuais (Views)
import { ViewLogin } from './views/view-login.js';
import { ViewCadastro } from './views/view-cadastro.js';
import { ViewAdmin } from './views/view-admin.js';
import { ViewAluno } from './views/view-aluno.js';
import { ViewSimulado } from './views/view-simulado.js';

// 2. Importação do motor de autenticação e sincronização
import { AuthModule } from './modules/auth.js';
import { SyncService } from './modules/sync-service.js';

class AppOrchestrator {
    constructor() {
        this.appContainer = document.getElementById('app');
        this.usuarioLogado = null;
        this.sincronizacaoEmAndamento = false;

        window.addEventListener('acesso-negado', (e) => {
            this.exibirTelaBloqueio(e.detail);
        });

        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada.');
            this.sincronizarDadosDoAluno(false);
        });

        window.addEventListener('offline', () => {
            console.log('📴 Aplicação em modo offline.');
        });
    }

    init() {
        this.exibirCarregando();

        AuthModule.observarSessao((usuario) => {
            if (usuario && usuario.status !== 'bloqueado') {
                this.usuarioLogado = usuario;
                this.rotearPorPerfil();
            } else if (usuario && usuario.status === 'bloqueado') {
                this.exibirTelaBloqueio(usuario.motivo || 'inativo');
            } else {
                this.usuarioLogado = null;
                this.navegarParaLogin();
            }
        });
    }

    rotearPorPerfil() {
        if (!this.usuarioLogado) {
            this.navegarParaLogin();
            return;
        }

        if (this.usuarioLogado.perfil === 'admin') {
            this.navegarParaAdmin();
            return;
        }

        if (this.usuarioLogado.perfil === 'aluno') {
            if (this.usuarioLogado.aprovado === true) {
                this.navegarParaDashboardAluno();
            } else {
                this.exibirAvisoBloqueio();
            }
        }
    }

    navegarParaLogin() {
        this.appContainer.innerHTML = ViewLogin.template;

        ViewLogin.init({
            onLogin: async (email, password) => {
                this.exibirCarregando();

                const resultado = await AuthModule.loginPiloto(email, password);

                if (!resultado.sucesso) {
                    alert(resultado.erro);
                    this.navegarParaLogin();
                    return;
                }

                this.usuarioLogado = resultado.usuario;

                if (resultado.modo === 'online') {
                    await this.sincronizarDadosDoAluno(true);
                }

                this.rotearPorPerfil();
            },
            onNavigateToRegister: () => this.navegarParaCadastro(),
            onForgotPassword: async (email) => {
                const resultado = await AuthModule.recuperarSenha(email);

                if (resultado?.sucesso) {
                    return {
                        sucesso: true,
                        mensagem: resultado.mensagem
                    };
                }

                return {
                    sucesso: false,
                    erro: resultado?.erro || 'Não foi possível enviar o e-mail de redefinição.'
                };
            }
        });
    }

    navegarParaCadastro() {
        this.appContainer.innerHTML = ViewCadastro.template;

        ViewCadastro.init({
            onRegister: async (email, password, curso) => {
                this.exibirCarregando();

                const resultado = await AuthModule.cadastrarPiloto(email, password, curso);

                if (resultado.sucesso) {
                    alert('Solicitação enviada com sucesso! Aguarde a liberação do administrador para acessar o cockpit.');
                    this.navegarParaLogin();
                } else {
                    alert(resultado.erro);
                    this.navegarParaCadastro();
                }
            },
            onNavigateToLogin: () => this.navegarParaLogin()
        });
    }

    navegarParaAdmin() {
        if (!navigator.onLine) {
            alert('Atenção, Administrador! O gerenciamento de alunos e provas requer conexão ativa com a rede.');
            AuthModule.deslogar();
            this.navegarParaLogin();
            return;
        }

        this.appContainer.innerHTML = ViewAdmin.template;
        ViewAdmin.init({
            onLogout: () => AuthModule.deslogar()
        });
    }

    navegarParaDashboardAluno() {
        this.appContainer.innerHTML = ViewAluno.template;

        ViewAluno.init(this.usuarioLogado, {
            onLogout: () => AuthModule.deslogar(),
            onIniciarSimulado: () => this.navegarParaSimulado()
        });

        this.sincronizarDadosDoAluno(false);

        document.getElementById('btn-iniciar-simulado')?.addEventListener('click', () => {
            this.navegarParaSimulado();
        });
    }

    async sincronizarDadosDoAluno(forcar = false) {
        if (!this.usuarioLogado || this.usuarioLogado.perfil !== 'aluno') return;
        if (!navigator.onLine && !SyncService.existeCacheValido()) {
            console.warn('Sem internet e sem cache válido de provas.');
            return;
        }

        if (this.sincronizacaoEmAndamento) return;

        this.sincronizacaoEmAndamento = true;

        try {
            const resultado = await SyncService.sincronizarProvas({ forcar });

            if (resultado?.sucesso) {
                window.dispatchEvent(new CustomEvent('chiteroicao-sync-dashboard', {
                    detail: resultado
                }));
            }

            if (!resultado.sucesso && !SyncService.existeCacheValido()) {
                console.warn('Nenhuma prova válida disponível para uso offline.');
            }
        } catch (erro) {
            console.error('Falha na sincronização de dados do aluno:', erro);
        } finally {
            this.sincronizacaoEmAndamento = false;
        }
    }

    exibirAvisoBloqueio() {
        this.appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-form" style="text-align: center;">
                    <h2 style="color: #f1c40f; margin-bottom: 20px;">ACESSO EM ANÁLISE</h2>
                    <p style="margin-bottom: 25px; color: #333;">
                        Seu cadastro foi recebido, mas ainda precisa ser liberado pelo administrador.
                    </p>
                    <button id="btn-voltar-login" class="btn-primary">Voltar ao Login</button>
                </div>
            </div>
        `;

        document.getElementById('btn-voltar-login')?.addEventListener('click', async () => {
            await AuthModule.deslogar();
            this.navegarParaLogin();
        });
    }

    exibirTelaBloqueio(motivo) {
        this.appContainer.innerHTML = `
            <div class="login-container">
                <div class="login-form" style="text-align: center;">
                    <h2 style="color: #e74c3c; margin-bottom: 20px;">ACESSO RESTRITO</h2>
                    <p style="margin-bottom: 25px; color: #333;">
                        ${motivo === 'expirado'
                            ? 'Seu plano de voo expirou. Entre em contato com a equipe de suporte.'
                            : 'Seu cadastro está inativo. Entre em contato com a equipe de suporte para regularizar sua situação.'}
                    </p>
                    <button id="btn-voltar-login" class="btn-primary">Voltar ao Login</button>
                </div>
            </div>
        `;

        document.getElementById('btn-voltar-login')?.addEventListener('click', async () => {
            await AuthModule.deslogar();
            this.navegarParaLogin();
        });
    }

    navegarParaSimulado() {
        if (!navigator.onLine && !SyncService.existeCacheValido()) {
            alert('Você está offline e não há cache válido de provas. Conecte-se à internet para sincronizar.');
            return;
        }

        this.appContainer.innerHTML = ViewSimulado.template;
        ViewSimulado.init();
    }

    exibirCarregando() {
        this.appContainer.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column; gap: 15px;">
                <div style="width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--gold-aviation); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="color: var(--text-muted-gray); font-size: 14px; letter-spacing: 1px;">SINCRO DE DADOS...</p>
            </div>
        `;
    }
}

const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    const app = new AppOrchestrator();
    window.orquestradorApp = app;
    app.init();
});
