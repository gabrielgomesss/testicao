// js/views/view-aluno.js

import { SyncService } from '../modules/sync-service.js';

export const ViewAluno = {
    pullRefreshAtivo: false,
    pullRefreshInicioY: 0,
    pullRefreshPronto: false,
    listenerAtualizacaoConfigurado: false,
    intervaloAtualizacaoCodigo: null,
    atualizacaoPendente: null,
    atualizacaoEmCurso: false,
    CACHE_CONFIRMADO_KEY: 'chiteroicao_cache_offline_confirmado',
    intervaloStatusOffline: null,
    verificacaoCacheEmAndamento: false,
    cacheOfflineConfirmado: false,
    leiturasCompletasConsecutivas: 0,
    ultimaQuantidadeCacheada: 0,
    ultimaQuantidadeTotal: 0,
    progressoCacheSW: null,
    ultimoProgressoRecebidoEm: 0,

    template: `
        <div class="dashboard-container" style="background: #000000; min-height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box;">

            <header class="header-wrapper">
                <div class="profile-menu-container">
  <button id="btn-profile-trigger" class="profile-avatar-btn" title="Menu do Piloto">
    <svg xmlns="http://www.w3.org/2000/svg"
         width="22"
         height="22"
         viewBox="0 0 24 24"
         fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
</button>

                    <div id="dropdown-profile-menu" class="profile-dropdown">
                        <div class="dropdown-info-item">
                            <span class="dropdown-label">PILOTO</span>
                            <span id="aluno-email" class="dropdown-value">...</span>
                        </div>

                        <div class="dropdown-info-item">
                            <span class="dropdown-label">CURSO ATIVO</span>
                            <span id="aluno-curso" class="dropdown-value" style="color: #00a8cc; font-weight: 600;">...</span>
                        </div>

                        <div class="dropdown-info-item">
                            <span class="dropdown-label">VALIDADE DO ACESSO</span>
                            <span id="aluno-validade" class="dropdown-value">...</span>
                        </div>

                        <div class="dropdown-info-item" style="margin-bottom: 18px;">
                            <span class="dropdown-label">MODO OFFLINE</span>
                            <span id="aluno-cache-status" class="dropdown-value">Verificando...</span>
                        </div>

                        <button id="btn-logout-aluno">Sair do Cockpit</button>
                    </div>
                </div>
            </header>

            <main class="dashboard-content" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 20px; box-sizing: border-box;">
                <div class="test-card-premium" style="background: #ffffff; border-radius: 24px; width: 100%; max-width: 350px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; box-sizing: border-box;">
                    <div style="position: relative; height: 260px; background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(255,255,255,1) 100%), url('./assets/imagens/images.jpeg') center center / cover no-repeat; display: flex; align-items: flex-end; justify-content: center;">
                        <div style="background: #ffffff; color: #111111; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 8px 24px; border-radius: 20px 20px 0 0; border: 1px solid #f5f5f5; border-bottom: none; margin-bottom: -1px; box-shadow: 0 -2px 10px rgba(0,0,0,0.03);">
                            AI Generator
                        </div>
                    </div>

                    <div style="background: #ffffff; padding: 25px 24px 30px 24px; text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; min-height: 250px; box-sizing: border-box;">
                        <div>
                            <h3 style="font-family: 'Cinzel', 'Times New Roman', serif; font-size: 20px; font-weight: 500; color: #111111; letter-spacing: 1.5px; margin: 0 0 15px 0; text-transform: uppercase;">
                                AI Test Generator
                            </h3>

                            <ul style="list-style: none; padding: 0; margin: 0 0 18px 0; display: flex; flex-direction: column; gap: 10px;">
                                <li style="font-size: 13px; color: #666666; font-weight: 400; letter-spacing: 0.2px;">100% ANAC database</li>
                                <li style="font-size: 13px; color: #666666; font-weight: 400; letter-spacing: 0.2px;">AI generated</li>
                                <li style="font-size: 13px; color: #666666; font-weight: 400; letter-spacing: 0.2px;">Transcripts & Models</li>
                                <li style="font-size: 13px; color: #666666; font-weight: 400; letter-spacing: 0.2px;">Offline ready for 24h</li>
                            </ul>

                            <div id="dashboard-cache-pill" style="margin: 0 auto 18px auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 999px; padding: 8px 12px; font-size: 11px; font-weight: 800; letter-spacing: .3px; background: #fee2e2; color: #991b1b; min-height: 18px;">
                                <span id="dashboard-cache-icon">⚠️</span>
                                <span id="dashboard-cache-text">Prova online indisponível</span>
                            </div>
                            <div id="dashboard-cache-progress-wrap" style="display:none;width:100%;max-width:230px;height:6px;background:#e5e7eb;border-radius:999px;margin:-8px auto 16px auto;overflow:hidden;">
                                <div id="dashboard-cache-progress-bar" style="width:0%;height:100%;background:#00a8cc;border-radius:999px;transition:width .25s ease;"></div>
                            </div>
                        </div>

                        <button id="btn-iniciar-simulado" style="background: #00a8cc; color: #ffffff; border: none; padding: 15px; border-radius: 10px; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; width: 100%; transition: background 0.2s ease; box-shadow: 0 4px 15px rgba(0, 168, 204, 0.3);">
                            Iniciar Simulado Oficial
                        </button>
                    </div>
                </div>
            </main>
        </div>
    `,

    init(usuarioLogado, callbacks) {
        this.configurarAtualizacaoAutomatica();
        this.ativarPullToRefreshIOS();

        document.getElementById('aluno-email').innerText = usuarioLogado.email || 'Não informado';
        document.getElementById('aluno-curso').innerText = usuarioLogado.cursoAtivo || 'Não Definido';

        const validadeElement = document.getElementById('aluno-validade');
        if (usuarioLogado.tipoExpiracao === 'vitalicio') {
            validadeElement.innerText = 'Vitalício';
            validadeElement.style.color = '#2ecc71';
        } else if (usuarioLogado.tokenExpiracao) {
            const dataFim = new Date(usuarioLogado.tokenExpiracao);
            validadeElement.innerText = dataFim.toLocaleDateString('pt-BR');
        } else {
            validadeElement.innerText = 'Em análise';
        }

        this.injetarCSSStatusCache();
        this.vincularProgressoServiceWorker();
        this.atualizarStatusOffline();

        if (this.intervaloStatusOffline) clearInterval(this.intervaloStatusOffline);

        // Mantém o badge estável e evita alternância visual.
        // Após confirmar 100% offline, o intervalo é encerrado.
        this.intervaloStatusOffline = setInterval(() => {
            if (!this.cacheOfflineConfirmado) {
                this.atualizarStatusOffline();
            }
        }, 1500);

        const btnProfile = document.getElementById('btn-profile-trigger');
        const dropdownMenu = document.getElementById('dropdown-profile-menu');

        btnProfile?.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu?.classList.toggle('show');
        });

        document.addEventListener('click', (event) => {
            if (dropdownMenu && !dropdownMenu.contains(event.target) && event.target !== btnProfile) {
                dropdownMenu.classList.remove('show');
            }
        });

        document.getElementById('btn-logout-aluno')?.addEventListener('click', () => {
            if (this.intervaloStatusOffline) {
                clearInterval(this.intervaloStatusOffline);
                this.intervaloStatusOffline = null;
            }

            callbacks.onLogout?.();
        });

        document.getElementById('btn-iniciar-simulado')?.addEventListener('click', () => {
            callbacks.onIniciarSimulado?.();
        });

        window.addEventListener('online', () => this.atualizarStatusOffline());
        window.addEventListener('offline', () => this.atualizarStatusOffline());

        window.addEventListener('chiteroicao-provas-atualizadas', (evento) => {
            this.cacheOfflineConfirmado = false;
            this.leiturasCompletasConsecutivas = 0;
            this.ultimaQuantidadeCacheada = 0;
            this.ultimaQuantidadeTotal = 0;

            if (evento?.detail?.houveMudanca) {
                localStorage.removeItem(this.CACHE_CONFIRMADO_KEY);
            }

            this.atualizarStatusOffline();
        });

        window.addEventListener('chiteroicao-sync-dashboard', () => {
            this.cacheOfflineConfirmado = false;
            this.atualizarStatusOffline();
        });
    },

    configurarAtualizacaoAutomatica() {
        if (!('serviceWorker' in navigator) || this.listenerAtualizacaoConfigurado) return;
        this.listenerAtualizacaoConfigurado = true;

        const observarRegistration = (registration) => {
            if (!registration) return;

            if (registration.waiting) {
                this.exibirAvisoNovaVersao(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;

                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                        this.exibirAvisoNovaVersao(registration.waiting || installing);
                    }
                });
            });
        };

        navigator.serviceWorker.ready.then(observarRegistration).catch(() => {});

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!this.atualizacaoEmCurso) return;
            const chave = 'chiteroicao_update_reload_done';
            if (sessionStorage.getItem(chave) === '1') return;
            sessionStorage.setItem(chave, '1');
            window.location.reload();
        });

        window.addEventListener('pageshow', () => {
            sessionStorage.removeItem('chiteroicao_update_reload_done');
        });

        const verificar = async () => {
            if (!navigator.onLine) return false;
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) return false;
                await registration.update();
                observarRegistration(registration);
                return Boolean(registration.waiting);
            } catch (erro) {
                console.warn('Não foi possível verificar atualização do aplicativo.', erro);
                return false;
            }
        };

        this.verificarAtualizacaoDisponivel = verificar;
        verificar();

        if (this.intervaloAtualizacaoCodigo) clearInterval(this.intervaloAtualizacaoCodigo);
        this.intervaloAtualizacaoCodigo = setInterval(verificar, 5 * 60 * 1000);
    },

    exibirAvisoNovaVersao(worker) {
        if (!worker) return;
        this.atualizacaoPendente = worker;

        let aviso = document.getElementById('chitero-update-banner');
        if (!aviso) {
            aviso = document.createElement('div');
            aviso.id = 'chitero-update-banner';
            aviso.style.cssText = 'position:fixed;left:12px;right:12px;bottom:16px;z-index:1000000;max-width:520px;margin:0 auto;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px;box-shadow:0 18px 45px rgba(0,0,0,.38);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:12px;';
            aviso.innerHTML = `
                <div style="min-width:0;">
                    <div style="font-size:13px;font-weight:900;margin-bottom:3px;">Nova versão disponível</div>
                    <div style="font-size:11px;color:#cbd5e1;line-height:1.4;">Atualize para receber as melhorias mais recentes. As provas offline serão preservadas.</div>
                </div>
                <button id="chitero-update-now" type="button" style="flex:0 0 auto;background:#5EBBDE;color:#fff;border:none;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer;">Atualizar agora</button>
            `;
            document.body.appendChild(aviso);
            aviso.querySelector('#chitero-update-now')?.addEventListener('click', () => this.aplicarAtualizacaoPendente());
        }
        aviso.style.display = 'flex';
    },

    async aplicarAtualizacaoPendente() {
        if (this.atualizacaoEmCurso) return;
        this.atualizacaoEmCurso = true;

        const botao = document.getElementById('chitero-update-now');
        if (botao) {
            botao.disabled = true;
            botao.innerText = 'Atualizando...';
        }

        try {
            let worker = this.atualizacaoPendente;
            if (!worker) {
                const registration = await navigator.serviceWorker.getRegistration();
                worker = registration?.waiting || null;
            }

            if (worker) {
                worker.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 5000);
                return;
            }

            window.location.reload();
        } catch (erro) {
            console.warn('Falha ao aplicar atualização.', erro);
            window.location.reload();
        }
    },

    async forcarAtualizacaoAplicacao() {
        if (!navigator.onLine) {
            window.location.reload();
            return;
        }

        const encontrou = await this.verificarAtualizacaoDisponivel?.();
        const registration = await navigator.serviceWorker.getRegistration().catch(() => null);

        if (encontrou || registration?.waiting) {
            this.exibirAvisoNovaVersao(registration.waiting);
            return;
        }

        window.location.reload();
    },

    ativarPullToRefreshIOS() {
        if (this.pullRefreshAtivo || typeof window === 'undefined' || !('ontouchstart' in window)) return;
        this.pullRefreshAtivo = true;

        let indicador = document.getElementById('aluno-pull-refresh-indicator');
        if (!indicador) {
            indicador = document.createElement('div');
            indicador.id = 'aluno-pull-refresh-indicator';
            indicador.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:999999;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;box-shadow:0 12px 30px rgba(0,0,0,.28);transition:transform .18s ease,opacity .18s ease;opacity:0;pointer-events:none;';
            indicador.innerText = 'Puxe para atualizar';
            document.body.appendChild(indicador);
        }

        const mostrar = (texto, pronto) => {
            indicador.innerText = texto;
            indicador.style.opacity = '1';
            indicador.style.transform = `translateX(-50%) translateY(${pronto ? '0' : '-18px'})`;
        };

        const ocultar = () => {
            indicador.style.opacity = '0';
            indicador.style.transform = 'translateX(-50%) translateY(-80px)';
        };

        window.addEventListener('touchstart', (event) => {
            const alvo = event.target;
            if (alvo?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
            if (window.scrollY > 2 || !event.touches?.length) return;

            this.pullRefreshInicioY = event.touches[0].clientY;
            this.pullRefreshPronto = false;
        }, { passive: true });

        window.addEventListener('touchmove', (event) => {
            if (!this.pullRefreshInicioY || window.scrollY > 2 || !event.touches?.length) return;

            const delta = event.touches[0].clientY - this.pullRefreshInicioY;
            if (delta <= 28) return;

            this.pullRefreshPronto = delta >= 86;
            mostrar(this.pullRefreshPronto ? 'Solte para atualizar' : 'Puxe para atualizar', this.pullRefreshPronto);
        }, { passive: true });

        window.addEventListener('touchend', () => {
            const atualizar = this.pullRefreshPronto;
            this.pullRefreshInicioY = 0;
            this.pullRefreshPronto = false;

            if (atualizar) {
                mostrar('Atualizando...', true);
                this.forcarAtualizacaoAplicacao();
            } else {
                ocultar();
            }
        }, { passive: true });
    },

    injetarCSSStatusCache() {
        if (document.getElementById('cache-status-style')) return;

        const style = document.createElement('style');
        style.id = 'cache-status-style';
        style.textContent = `
            @keyframes cacheSpin {
                to { transform: rotate(360deg); }
            }

            .cache-spinner {
                width: 12px;
                height: 12px;
                border: 2px solid currentColor;
                border-top-color: transparent;
                border-radius: 999px;
                display: inline-block;
                animation: cacheSpin .8s linear infinite;
            }
        `;

        document.head.appendChild(style);
    },

    lerJSON(chave) {
        try {
            const valor = localStorage.getItem(chave);
            return valor ? JSON.parse(valor) : null;
        } catch (erro) {
            console.warn(`JSON inválido em ${chave}`, erro);
            return null;
        }
    },

    obterBancoCacheLocal() {
        const candidatos = [
            'dados_simulado_cache',
            'provas_cache',
            'cache_provas',
            'banco_provas_cache',
            'simulado_cache'
        ];

        if (SyncService.obterProvasCache) {
            const viaService = SyncService.obterProvasCache();
            if (viaService) return viaService;
        }

        for (const chave of candidatos) {
            const valor = this.lerJSON(chave);
            if (valor) return valor;
        }

        return null;
    },

    obterMetaCacheLocal() {
        const candidatos = [
            'dados_simulado_cache_meta',
            'provas_cache_meta',
            'cache_provas_meta',
            'sync_provas_meta',
            'meta_simulado_cache'
        ];

        if (SyncService.obterMetaCache) {
            const viaService = SyncService.obterMetaCache();
            if (viaService) return viaService;
        }

        for (const chave of candidatos) {
            const valor = this.lerJSON(chave);
            if (valor) return valor;
        }

        return null;
    },

    isUrlMidia(valor) {
        if (typeof valor !== 'string') return false;

        const url = valor.trim();

        return /^https?:\/\//i.test(url)
            && (
                /\.(mp3|wav|m4a|ogg|aac|mp4|webm|png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url)
                || url.includes('firebasestorage.googleapis.com')
                || url.includes('storage.googleapis.com')
            );
    },

    coletarUrlsMidia(objeto, urls = new Set()) {
        if (!objeto) return urls;

        if (typeof objeto === 'string') {
            if (this.isUrlMidia(objeto)) {
                urls.add(objeto);
            }

            return urls;
        }

        if (Array.isArray(objeto)) {
            objeto.forEach((item) => this.coletarUrlsMidia(item, urls));
            return urls;
        }

        if (typeof objeto === 'object') {
            Object.values(objeto).forEach((valor) => this.coletarUrlsMidia(valor, urls));
        }

        return urls;
    },

    async urlEstaNoCache(url) {
        if (!('caches' in window)) return false;

        try {
            const nomesCaches = await caches.keys();

            for (const nomeCache of nomesCaches) {
                const cache = await caches.open(nomeCache);

                const direto = await cache.match(url, { ignoreSearch: false });
                if (direto) return true;

                const semQuery = await cache.match(url, { ignoreSearch: true });
                if (semQuery) return true;

                // Fallback mais forte: procura por pathname, útil quando token muda.
                const requestKeys = await cache.keys();

                try {
                    const alvo = new URL(url);
                    const encontrado = requestKeys.some((request) => {
                        try {
                            const reqUrl = new URL(request.url);
                            return reqUrl.origin === alvo.origin && reqUrl.pathname === alvo.pathname;
                        } catch {
                            return false;
                        }
                    });

                    if (encontrado) return true;
                } catch {
                    // ignora URL inválida
                }
            }
        } catch (erro) {
            console.warn('Erro ao verificar cache de mídia:', url, erro);
        }

        return false;
    },

    async contarMidiasCacheadas(urls = []) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return 0;
        }

        let cacheadas = 0;

        for (const url of urls) {
            if (await this.urlEstaNoCache(url)) {
                cacheadas++;
            }
        }

        return cacheadas;
    },

    definirPill({ estado, texto, detalhe = '', progresso = null }) {
        const statusMenu = document.getElementById('aluno-cache-status');
        const pill = document.getElementById('dashboard-cache-pill');
        const icon = document.getElementById('dashboard-cache-icon');
        const text = document.getElementById('dashboard-cache-text');
        const progressWrap = document.getElementById('dashboard-cache-progress-wrap');
        const progressBar = document.getElementById('dashboard-cache-progress-bar');

        const estados = {
            pronto: {
                bg: '#dcfce7',
                cor: '#166534',
                iconHTML: '✅'
            },
            baixando: {
                bg: '#e0f2fe',
                cor: '#0369a1',
                iconHTML: '<span class="cache-spinner"></span>'
            },
            indisponivel: {
                bg: '#fee2e2',
                cor: '#991b1b',
                iconHTML: '⚠️'
            },
            verificando: {
                bg: '#f1f5f9',
                cor: '#334155',
                iconHTML: '<span class="cache-spinner"></span>'
            }
        };

        const config = estados[estado] || estados.verificando;

        if (pill) {
            pill.style.background = config.bg;
            pill.style.color = config.cor;
        }

        if (icon) {
            icon.innerHTML = config.iconHTML;
        }

        if (text) {
            text.innerText = texto;
        }

        if (statusMenu) {
            statusMenu.innerText = detalhe || texto;
            statusMenu.style.color = config.cor;
        }

        if (progressWrap && progressBar) {
            const deveExibir = progresso && Number(progresso.total || 0) > 0 && estado === 'baixando';
            progressWrap.style.display = deveExibir ? 'block' : 'none';

            if (deveExibir) {
                const total = Math.max(Number(progresso.total || 0), 1);
                const cacheados = Math.max(Number(progresso.cacheados || 0), 0);
                const percentual = Math.min(100, Math.round((cacheados / total) * 100));
                progressBar.style.width = `${percentual}%`;
            } else {
                progressBar.style.width = estado === 'pronto' ? '100%' : '0%';
            }
        }
    },

    vincularProgressoServiceWorker() {
        if (!('serviceWorker' in navigator) || this.listenerProgressoSWConfigurado) return;

        this.listenerProgressoSWConfigurado = true;

        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event.data || {};

            if (data.type !== 'CACHE_PROGRESS') return;

            const total = Number(data.total || 0);
            const cacheados = Number(data.cacheados || 0);
            const processados = Number(data.processados || 0);
            const falhas = Number(data.falhas || 0);
            const concluido = data.concluido === true;

            this.progressoCacheSW = {
                total,
                cacheados,
                processados,
                falhas,
                concluido
            };
            this.ultimoProgressoRecebidoEm = Date.now();

            if (total <= 0) return;

            if (!concluido || cacheados < total) {
                this.cacheOfflineConfirmado = false;
                this.leiturasCompletasConsecutivas = 0;
                this.definirPill({
                    estado: 'baixando',
                    texto: `Baixando prova offline ${cacheados}/${total}`,
                    detalhe: falhas > 0
                        ? `Baixando ${cacheados}/${total}. Repetindo ${falhas} arquivo(s) ao final.`
                        : `Baixando arquivos: ${cacheados}/${total}`,
                    progresso: this.progressoCacheSW
                });
                return;
            }

            this.definirPill({
                estado: 'baixando',
                texto: `Finalizando cache ${cacheados}/${total}`,
                detalhe: `Arquivos baixados: ${cacheados}/${total}`,
                progresso: this.progressoCacheSW
            });

            // Confirma logo depois pelo leitor local do Cache Storage.
            setTimeout(() => this.atualizarStatusOffline(), 350);
        });
    },

    salvarConfirmacaoCacheOffline(meta = {}) {
        try {
            const payload = {
                confirmadoEm: new Date().toISOString(),
                validoAte: meta?.validoAte || null
            };

            localStorage.setItem(this.CACHE_CONFIRMADO_KEY, JSON.stringify(payload));
        } catch (erro) {
            console.warn('Não foi possível salvar confirmação do cache offline:', erro);
        }
    },

    cacheOfflineConfirmadoPersistido() {
        try {
            const raw = localStorage.getItem(this.CACHE_CONFIRMADO_KEY);
            if (!raw) return false;

            const payload = JSON.parse(raw);

            if (payload?.validoAte) {
                const expirou = Date.now() > new Date(payload.validoAte).getTime();

                if (expirou) {
                    localStorage.removeItem(this.CACHE_CONFIRMADO_KEY);
                    return false;
                }
            }

            return true;
        } catch (erro) {
            localStorage.removeItem(this.CACHE_CONFIRMADO_KEY);
            return false;
        }
    },

    async atualizarStatusOffline() {
        if (this.verificacaoCacheEmAndamento) {
            return;
        }

        if (!navigator.onLine && (this.cacheOfflineConfirmado || this.cacheOfflineConfirmadoPersistido())) {
            this.definirPill({
                estado: 'pronto',
                texto: 'Provas offline disponíveis',
                detalhe: 'Cache completo confirmado'
            });
            return;
        }

        this.verificacaoCacheEmAndamento = true;

        try {
            const cacheTextualValido = SyncService.existeCacheValido?.() === true;
            const bancoCache = this.obterBancoCacheLocal();
            const meta = this.obterMetaCacheLocal();

            /*
                Quando o aluno finaliza uma prova e volta para o dashboard,
                a view é recriada e perde o estado em memória.
                Se o cache já foi confirmado anteriormente e ainda existe banco local,
                mantemos o badge verde mesmo offline.
            */
            if (!navigator.onLine && bancoCache && this.cacheOfflineConfirmadoPersistido()) {
                this.cacheOfflineConfirmado = true;

                const validadePersistida = meta?.validoAte
                    ? `Disponível até ${new Date(meta.validoAte).toLocaleString('pt-BR')}`
                    : 'Cache completo confirmado';

                this.definirPill({
                    estado: 'pronto',
                    texto: 'Provas offline disponíveis',
                    detalhe: validadePersistida
                });

                return;
            }

            if (navigator.onLine) {
                this.definirPill({
                    estado: 'baixando',
                    texto: 'Baixando prova offline',
                    detalhe: 'Preparando provas, áudios e imagens para uso offline...'
                });
            } else {
                this.definirPill({
                    estado: 'indisponivel',
                    texto: 'Prova online indisponível',
                    detalhe: 'Cache offline ainda não foi confirmado'
                });
            }

            if (!cacheTextualValido || !bancoCache) {
                this.leiturasCompletasConsecutivas = 0;
                return;
            }

            const urls = Array.from(this.coletarUrlsMidia(bancoCache));
            const totalDetectado = urls.length;
            const totalMeta = Number(meta?.totalMidias || 0);
            const totalMidias = Math.max(totalDetectado, totalMeta);

            if (totalMidias === 0 || totalDetectado === 0) {
                this.leiturasCompletasConsecutivas = 0;
                return;
            }

            const midiasCacheadas = await this.contarMidiasCacheadas(urls);

            const totalMudou = totalMidias !== this.ultimaQuantidadeTotal;
            const quantidadeSubiu = midiasCacheadas > this.ultimaQuantidadeCacheada;
            const completoAgora = midiasCacheadas >= totalMidias;

            this.ultimaQuantidadeCacheada = midiasCacheadas;
            this.ultimaQuantidadeTotal = totalMidias;

            if (!completoAgora) {
                this.leiturasCompletasConsecutivas = 0;

                if (navigator.onLine) {
                    this.definirPill({
                        estado: 'baixando',
                        texto: 'Baixando prova offline',
                        detalhe: `Download em andamento: ${midiasCacheadas}/${totalMidias}`
                    });
                    return;
                }

                this.definirPill({
                    estado: 'indisponivel',
                    texto: 'Prova online indisponível',
                    detalhe: `Cache incompleto: ${midiasCacheadas}/${totalMidias}`
                });
                return;
            }

            /*
                Critério rígido:
                só libera verde quando estiver completo e estável.
                Isso evita aparecer disponível enquanto o Service Worker ainda baixa arquivos.
            */
            if (totalMudou || quantidadeSubiu) {
                this.leiturasCompletasConsecutivas = 1;
            } else {
                this.leiturasCompletasConsecutivas += 1;
            }

            if (this.leiturasCompletasConsecutivas < 4) {
                if (navigator.onLine) {
                    this.definirPill({
                        estado: 'baixando',
                        texto: `Finalizando cache ${midiasCacheadas}/${totalMidias}`,
                        detalhe: `Finalizando cache offline: ${midiasCacheadas}/${totalMidias}`,
                        progresso: { cacheados: midiasCacheadas, total: totalMidias }
                    });
                    return;
                }

                this.definirPill({
                    estado: 'indisponivel',
                    texto: 'Prova online indisponível',
                    detalhe: `Cache ainda não confirmado: ${midiasCacheadas}/${totalMidias}`
                });
                return;
            }

            this.cacheOfflineConfirmado = true;
            this.salvarConfirmacaoCacheOffline(meta);

            const validade = meta?.validoAte
                ? `Disponível até ${new Date(meta.validoAte).toLocaleString('pt-BR')}`
                : `${midiasCacheadas}/${totalMidias} mídias cacheadas`;

            this.definirPill({
                estado: 'pronto',
                texto: 'Provas offline disponíveis',
                detalhe: validade
            });

            if (this.intervaloStatusOffline) {
                clearInterval(this.intervaloStatusOffline);
                this.intervaloStatusOffline = null;
            }

        } finally {
            this.verificacaoCacheEmAndamento = false;
        }
    }
};
