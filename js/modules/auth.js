// js/modules/auth.js

import { auth, db } from '../firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const AUTH_CACHE_KEY = 'piloto_dados_cache';
const AUTH_FLAG_KEY = 'piloto_autenticado';
const OFFLINE_SESSION_KEY = 'piloto_sessao_offline';
const OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

function agoraISO() {
    return new Date().toISOString();
}

function dataMais24hISO() {
    return new Date(Date.now() + OFFLINE_WINDOW_MS).toISOString();
}

function normalizarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isOnline() {
    return navigator.onLine === true;
}

function lerJSON(chave) {
    try {
        const valor = localStorage.getItem(chave);
        return valor ? JSON.parse(valor) : null;
    } catch (erro) {
        console.warn(`Cache local inválido em ${chave}. Limpando chave.`, erro);
        localStorage.removeItem(chave);
        return null;
    }
}

function salvarSessaoLocal(usuario) {
    const dadosSeguros = {
        ...usuario,
        email: normalizarEmail(usuario.email),
        ultimaValidacaoOnline: agoraISO(),
        offlinePermitidoAte: dataMais24hISO()
    };

    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(dadosSeguros));
    localStorage.setItem(AUTH_FLAG_KEY, 'true');
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({
        uid: dadosSeguros.uid,
        email: dadosSeguros.email,
        perfil: dadosSeguros.perfil,
        aprovado: dadosSeguros.aprovado === true,
        status: dadosSeguros.status || 'ativo',
        tokenExpiracao: dadosSeguros.tokenExpiracao || null,
        tipoExpiracao: dadosSeguros.tipoExpiracao || null,
        ultimaValidacaoOnline: dadosSeguros.ultimaValidacaoOnline,
        offlinePermitidoAte: dadosSeguros.offlinePermitidoAte
    }));

    return dadosSeguros;
}

function carregarUsuarioLocal() {
    return lerJSON(AUTH_CACHE_KEY);
}

function sessaoOfflineValida(usuario, emailInformado = null) {
    if (!usuario) {
        return { valida: false, motivo: 'Não existe sessão offline salva neste dispositivo.' };
    }

    if (emailInformado && normalizarEmail(usuario.email) !== normalizarEmail(emailInformado)) {
        return { valida: false, motivo: 'Este e-mail não corresponde ao último usuário validado neste dispositivo.' };
    }

    if (usuario.perfil === 'admin') {
        return { valida: false, motivo: 'O painel administrativo exige conexão com a internet.' };
    }

    if (usuario.status === 'inativo' || usuario.status === 'bloqueado') {
        return { valida: false, motivo: 'Seu cadastro está inativo. Conecte-se à internet ou fale com o suporte.' };
    }

    if (usuario.aprovado !== true) {
        return { valida: false, motivo: 'Seu acesso ainda não foi aprovado pelo administrador.' };
    }

    if (usuario.tipoExpiracao === 'temporario' && usuario.tokenExpiracao) {
        const tokenExpirou = Date.now() > new Date(usuario.tokenExpiracao).getTime();
        if (tokenExpirou) {
            return { valida: false, motivo: 'Seu token de acesso expirou. Conecte-se à internet para validar novamente.' };
        }
    }

    if (!usuario.offlinePermitidoAte) {
        return { valida: false, motivo: 'Sessão offline sem data de validade. Faça login online novamente.' };
    }

    const offlineExpirou = Date.now() > new Date(usuario.offlinePermitidoAte).getTime();
    if (offlineExpirou) {
        return { valida: false, motivo: 'Seu período offline de 24h expirou. Faça login online novamente.' };
    }

    return { valida: true, motivo: null };
}

function erroPareceOffline(error) {
    const code = error?.code || '';
    const message = String(error?.message || '').toLowerCase();

    return !isOnline()
        || code === 'auth/network-request-failed'
        || message.includes('network')
        || message.includes('offline')
        || message.includes('failed to fetch');
}

export const AuthModule = {
    async cadastrarPiloto(email, password, curso) {
        if (!isOnline()) {
            return {
                sucesso: false,
                erro: 'Cadastro indisponível offline. Conecte-se à internet para solicitar acesso.'
            };
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const perfilPiloto = {
                uid: userCredential.user.uid,
                email: normalizarEmail(email),
                cursoAtivo: curso,
                perfil: 'aluno',
                aprovado: false,
                status: 'inativo',
                tipoExpiracao: 'indeterminado',
                tokenExpiracao: null,
                dataCadastro: agoraISO()
            };

            await setDoc(doc(db, 'usuarios', userCredential.user.uid), perfilPiloto);
            return { sucesso: true, dados: perfilPiloto };
        } catch (error) {
            return { sucesso: false, erro: this._traduzirErro(error.code) };
        }
    },

    async loginPiloto(email, password) {
        const emailNormalizado = normalizarEmail(email);

        if (!isOnline()) {
            return this.loginOffline(emailNormalizado);
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, emailNormalizado, password);
            const perfil = await this._buscarPerfilOnline(userCredential.user.uid);

            if (!perfil) {
                return { sucesso: false, erro: 'Perfil não encontrado.' };
            }

            const validacao = await this._validarPerfilOnline(perfil);
            if (!validacao.sucesso) {
                return validacao;
            }

            const usuarioCacheado = salvarSessaoLocal(perfil);
            return { sucesso: true, usuario: usuarioCacheado, modo: 'online' };
        } catch (error) {
            if (erroPareceOffline(error)) {
                return this.loginOffline(emailNormalizado);
            }

            return { sucesso: false, erro: this._traduzirErro(error.code) };
        }
    },

    loginOffline(email) {
        const usuarioLocal = carregarUsuarioLocal();
        const validacao = sessaoOfflineValida(usuarioLocal, email);

        if (!validacao.valida) {
            return {
                sucesso: false,
                erro: `${validacao.motivo} O primeiro login precisa ser online.`
            };
        }

        localStorage.setItem(AUTH_FLAG_KEY, 'true');
        return {
            sucesso: true,
            usuario: {
                ...usuarioLocal,
                modoOffline: true
            },
            modo: 'offline'
        };
    },

    observarSessao(callback) {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                const usuarioLocal = carregarUsuarioLocal();
                const validacao = sessaoOfflineValida(usuarioLocal);

                if (validacao.valida && localStorage.getItem(AUTH_FLAG_KEY) === 'true') {
                    callback({ ...usuarioLocal, modoOffline: true });
                    return;
                }

                callback(null);
                return;
            }

            if (!isOnline()) {
                const usuarioLocal = carregarUsuarioLocal();
                const validacao = sessaoOfflineValida(usuarioLocal, user.email);

                if (validacao.valida) {
                    callback({ ...usuarioLocal, modoOffline: true });
                    return;
                }

                callback(null);
                return;
            }

            try {
                const u = await this._buscarPerfilOnline(user.uid);

                if (!u) {
                    callback(null);
                    return;
                }

                const validacao = await this._validarPerfilOnline(u);
                if (!validacao.sucesso) {
                    callback({ status: 'bloqueado', motivo: validacao.motivo || 'inativo' });
                    return;
                }

                const usuarioCacheado = salvarSessaoLocal(u);
                callback(usuarioCacheado);
            } catch (e) {
                console.error('Erro na observação de sessão:', e);

                const usuarioLocal = carregarUsuarioLocal();
                const validacao = sessaoOfflineValida(usuarioLocal, user.email);

                if (validacao.valida) {
                    callback({ ...usuarioLocal, modoOffline: true });
                    return;
                }

                callback(null);
            }
        });
    },

    async _buscarPerfilOnline(uid) {
        const docSnap = await getDoc(doc(db, 'usuarios', uid));
        if (!docSnap.exists()) return null;
        return { uid, ...docSnap.data() };
    },

    async _validarPerfilOnline(usuario) {
        if (usuario.status === 'inativo' || usuario.status === 'bloqueado') {
            console.warn('Acesso negado: Usuário inativo.');
            window.dispatchEvent(new CustomEvent('acesso-negado', { detail: 'inativo' }));
            return {
                sucesso: false,
                erro: 'Seu cadastro está inativo. Entre em contato com o suporte.',
                motivo: 'inativo'
            };
        }

        if (usuario.tipoExpiracao === 'temporario' && usuario.tokenExpiracao) {
            const expirou = Date.now() > new Date(usuario.tokenExpiracao).getTime();

            if (expirou) {
                try {
                    await updateDoc(doc(db, 'usuarios', usuario.uid), { status: 'inativo' });
                } catch (erro) {
                    console.warn('Não foi possível atualizar status expirado no Firestore:', erro);
                }

                window.dispatchEvent(new CustomEvent('acesso-negado', { detail: 'expirado' }));
                return {
                    sucesso: false,
                    erro: 'Seu plano de voo expirou. Entre em contato com o suporte.',
                    motivo: 'expirado'
                };
            }
        }

        return { sucesso: true };
    },

    getUsuarioCacheado() {
        return carregarUsuarioLocal();
    },

    sessaoOfflineEstaValida() {
        const usuarioLocal = carregarUsuarioLocal();
        return sessaoOfflineValida(usuarioLocal);
    },

    _traduzirErro(codigo) {
        const erros = {
            'auth/email-already-in-use': 'E-mail já registrado.',
            'auth/invalid-email': 'E-mail inválido.',
            'auth/invalid-credential': 'E-mail ou senha incorretos.',
            'auth/wrong-password': 'Senha incorreta.',
            'auth/user-not-found': 'Nenhum usuário encontrado com este e-mail.',
            'auth/network-request-failed': 'Sem conexão. Tentando acesso offline...',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
            'auth/missing-email': 'Informe um e-mail válido.',
            'auth/unauthorized-continue-uri': 'O domínio de redirecionamento não está autorizado no Firebase Authentication.',
            'auth/invalid-continue-uri': 'A URL de redirecionamento configurada é inválida.',
            'auth/user-disabled': 'Este usuário foi desativado.',
            'auth/operation-not-allowed': 'Operação não permitida. Verifique as configurações do Firebase Authentication.'
        };

        return erros[codigo] || 'Ocorreu um erro. Tente novamente.';
    },

    async recuperarSenha(email) {
        if (!isOnline()) {
            return {
                sucesso: false,
                erro: 'Redefinição de senha indisponível offline. Conecte-se à internet para receber o e-mail.'
            };
        }

        try {
            await sendPasswordResetEmail(auth, normalizarEmail(email));

            return {
                sucesso: true,
                mensagem: 'Enviamos um link para redefinição de senha para o e-mail informado. Verifique sua caixa de entrada e também o spam.'
            };
        } catch (error) {
            return {
                sucesso: false,
                erro: this._traduzirErro(error.code)
            };
        }
    },

    async deslogar() {
        localStorage.removeItem(AUTH_FLAG_KEY);

        try {
            await signOut(auth);
        } catch (erro) {
            console.warn('Falha ao encerrar sessão Firebase. Limpando sessão local mesmo assim.', erro);
        }
    },

    async limparSessaoLocalCompleta() {
        localStorage.removeItem(AUTH_FLAG_KEY);
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(OFFLINE_SESSION_KEY);

        try {
            await signOut(auth);
        } catch (erro) {
            console.warn('Falha ao sair do Firebase:', erro);
        }
    }
};