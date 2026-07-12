// js/views/view-simulado.js
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db } from '../firebase-config.js';

export const ViewSimulado = {
    APP_BUILD: '2026-07-10-auto-update-ios-v2',
    APP_VERSION_KEY: 'chiteroicao_simulado_app_build',
    pullRefreshAtivo: false,
    pullRefreshInicioY: 0,
    pullRefreshDisparado: false,
    listenerAtualizacaoConfigurado: false,
    intervaloAtualizacaoCodigo: null,
    atualizacaoPendente: null,
    atualizacaoEmCurso: false,

    config: {
        quantidadePorFase: {
            1: 3,
            2: 5,
            3: 1,
            4: 1
        }
    },

    estado: {
        faseAtiva: 1,
        situacaoIndice: 0,
        questoesSorteadas: {},
        naComparacao: false,
        idProvaSelecionada: null
    },

    dados: { fase1: [], fase2: [], fase3: [], fase4: [] },

    template: `
        <div class="simulador-master" style="width: 100%; max-width: 900px; margin: 0 auto; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #1e1e1e; padding: 20px; box-sizing: border-box;">
            <div class="fases-icon-bar">
                <div class="icon-fase-btn" id="btn-fase-1" style="cursor: pointer; text-align: center;"><img src="assets/icons/p1.png" class="icon-circle" style="background: #e0e0e0;"></img></div>
                <div class="icon-fase-btn" id="btn-fase-2" style="cursor: pointer; text-align: center;"><img src="assets/icons/p2.png" class="icon-circle" style="background: #e0e0e0;"></img></div>
                <div class="icon-fase-btn" id="btn-fase-3" style="cursor: pointer; text-align: center;"><img src="assets/icons/p3.png" class="icon-circle" style="background: #e0e0e0;"></img></div>
                <div class="icon-fase-btn" id="btn-fase-4" style="cursor: pointer; text-align: center;"><img src="assets/icons/p4.png" class="icon-circle" style="background: #e0e0e0;"></img></div>
            </div>

            <div id="instrucao-fase-texto" style="font-size: 14px; color: #444; line-height: 1.6; text-align: center; max-width: 750px; margin: 0 auto 25px auto; border-bottom: 1px solid #eee; padding-bottom: 15px;"></div>
            <div id="pilulas-navegacao-container" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 25px; flex-wrap: wrap;"></div>

            <div class="question-card">
                <div style="display: flex; align-items: center; gap: 5px; font-size: 13px; color: #666; margin-bottom: 20px;">
                    💡 <span>Same situations?</span>
                    <a id="btn-refresh-simulado" style="color: #00a8cc; text-decoration: none; cursor: pointer;">Refresh the page</a>
                </div>
                <div id="conteudo-card-dinamico"></div>
            </div>

            <div style="margin-top: 25px; display: flex; justify-content: flex-end;">
                <button id="btn-proxima-etapa" style="background: #000; color: #fff; border: none; padding: 12px 28px; border-radius: 25px; font-weight: bold; cursor: pointer; font-size: 14px; transition: background 0.2s;">
                    Next Step
                </button>
            </div>
        </div>
    `,

    async init() {
        /*
            Importante para o modo offline:
            A prova precisa renderizar imediatamente a partir do cache local.
            Não podemos aguardar Firestore aqui, porque logo após desligar a rede
            o navegador ainda pode considerar navigator.onLine=true por alguns segundos,
            causando tela branca até o getDoc falhar.
        */

        this.verificarAtualizacaoCodigoEmCache();
        this.ativarPullToRefreshIOS();

        this.carregarDadosDoCacheLocal();
        this.gerarProvaSorteada();
        this.vincularEventosFases();
        this.renderizarEstruturaCompleta();

        // Verificação de segurança online em segundo plano.
        // Não bloqueia mais a renderização da prova.
        this.verificarSessaoOnlineEmSegundoPlano();
    },

    async verificarSessaoOnlineEmSegundoPlano() {
        if (!navigator.onLine) {
            console.log("✈️ Cockpit Offline: verificação Firestore ignorada.");
            return;
        }

        try {
            const auth = getAuth();

            if (!auth.currentUser) {
                return;
            }

            const userRef = doc(db, 'usuarios', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists() && userSnap.data().status === 'inativo') {
                alert("🚨 Sessão Encerrada: Cadastro inativado.");
                await signOut(auth);
                location.reload();
            }
        } catch (erro) {
            console.warn("⚠️ Falha na verificação online em segundo plano. Mantendo prova via cache local.", erro);
        }
    },

    async verificarAtualizacaoCodigoEmCache() {
        if (!('serviceWorker' in navigator) || this.listenerAtualizacaoConfigurado) return;
        this.listenerAtualizacaoConfigurado = true;

        const observarRegistration = (registration) => {
            if (!registration) return;
            if (registration.waiting) this.exibirAvisoNovaVersao(registration.waiting);

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

        window.addEventListener('pageshow', () => sessionStorage.removeItem('chiteroicao_update_reload_done'));

        const verificar = async () => {
            if (!navigator.onLine) return false;
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) return false;
                await registration.update();
                observarRegistration(registration);
                return Boolean(registration.waiting);
            } catch (erro) {
                console.warn('Falha ao verificar atualização do código.', erro);
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
                    <div style="font-size:11px;color:#cbd5e1;line-height:1.4;">Finalize a etapa atual ou atualize agora. Seu banco de provas offline será preservado.</div>
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

    async forcarRefreshCodigo() {
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
        if (this.pullRefreshAtivo || typeof window === 'undefined') return;
        this.pullRefreshAtivo = true;

        let indicador = document.getElementById('simulado-pull-refresh-indicator');
        if (!indicador) {
            indicador = document.createElement('div');
            indicador.id = 'simulado-pull-refresh-indicator';
            indicador.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:999999;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;box-shadow:0 12px 30px rgba(0,0,0,.28);transition:transform .18s ease, opacity .18s ease;opacity:0;pointer-events:none;';
            indicador.innerText = 'Puxe para atualizar';
            document.body.appendChild(indicador);
        }

        const mostrar = (texto, ativo = false) => {
            indicador.innerText = texto;
            indicador.style.opacity = '1';
            indicador.style.transform = `translateX(-50%) translateY(${ativo ? '0' : '-18px'})`;
        };

        const ocultar = () => {
            indicador.style.opacity = '0';
            indicador.style.transform = 'translateX(-50%) translateY(-80px)';
        };

        window.addEventListener('touchstart', (event) => {
            if (window.scrollY > 2 || !event.touches?.length) return;
            this.pullRefreshInicioY = event.touches[0].clientY;
            this.pullRefreshDisparado = false;
        }, { passive: true });

        window.addEventListener('touchmove', (event) => {
            if (!this.pullRefreshInicioY || window.scrollY > 2 || !event.touches?.length) return;

            const delta = event.touches[0].clientY - this.pullRefreshInicioY;

            if (delta > 35) {
                mostrar(delta > 78 ? 'Solte para atualizar' : 'Puxe para atualizar', delta > 78);
            }

            if (delta > 92) {
                this.pullRefreshDisparado = true;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            const deveAtualizar = this.pullRefreshDisparado;
            this.pullRefreshInicioY = 0;
            this.pullRefreshDisparado = false;

            if (deveAtualizar) {
                mostrar('Atualizando...', true);
                this.forcarRefreshCodigo();
                return;
            }

            ocultar();
        }, { passive: true });
    },

    carregarDadosDoCacheLocal() {
        const chavesPossiveis = ['dados_simulado_cache', 'sdea_banco_provas', 'provas_cache'];

        for (const chave of chavesPossiveis) {
            try {
                const bruto = localStorage.getItem(chave);
                if (!bruto) continue;

                const dados = JSON.parse(bruto);

                if (dados?.fase1 && dados?.fase2 && dados?.fase3 && dados?.fase4) {
                    this.dados = dados;
                    console.log(`📦 Simulado carregado do cache local: ${chave}`);
                    return;
                }

                if (Array.isArray(dados?.provas) && dados.provas.length) {
                    const provasAtivas = dados.provas.filter((prova) => prova?.ativa !== false && prova?.fases);
                    const provasValidas = provasAtivas.length ? provasAtivas : dados.provas.filter((prova) => prova?.fases);
                    const fases = { fase1: [], fase2: [], fase3: [], fase4: [] };

                    provasValidas.forEach((prova) => {
                        ['fase1', 'fase2', 'fase3', 'fase4'].forEach((fase) => {
                            (prova.fases?.[fase] || []).forEach((item) => {
                                fases[fase].push({
                                    idProva: item.idProva || prova.id,
                                    ...item
                                });
                            });
                        });
                    });

                    this.dados = fases;
                    console.log(`📦 Simulado carregado do cache local estruturado: ${chave}`);
                    return;
                }
            } catch (erro) {
                console.warn(`⚠️ Cache inválido em ${chave}. Usando próxima fonte.`, erro);
            }
        }

        console.warn("⚠️ Nenhum cache local de provas encontrado. O simulado precisa de sincronização com o Firestore antes de iniciar.");
    },

    gerarProvaSorteada() {
        /*
            Modelo ajustado conforme alinhamento:
            - Fase 1: sorteia 3 questões de todo o banco.
            - Fase 2: as interações 1, 2 e 3 sorteiam do mesmo pool sem imagem obrigatória.
              As interações 4 e 5 sorteiam do mesmo pool com imagem obrigatória.
              O campo interacao cadastrado no admin passa a ser usado apenas como grupo de origem.
            - Fase 3: sorteia situações individualmente de todo o banco, sem prender a situação
              ao bloco em que foi cadastrada.
            - Fase 4: sorteia 1 photo.
        */

        const fase1 = Array.isArray(this.dados.fase1) ? this.dados.fase1 : [];
        const fase4 = Array.isArray(this.dados.fase4) ? this.dados.fase4 : [];

        const fase2Ordenada = [];

        for (let interacao = 1; interacao <= 5; interacao++) {
            const candidatas = this.obterCandidatasFase2PorInteracao(interacao);

            if (candidatas.length) {
                const sorteada = this.embaralharELimitar(candidatas, 1)[0];
                fase2Ordenada.push({
                    ...sorteada,
                    interacao
                });
            } else {
                console.warn(`Nenhuma questão encontrada para a Fase 2, Interaction ${interacao}.`);
            }
        }

        const situacoesFase3 = this.obterPoolSituacoesFase3();
        const situacoesSorteadas = this.embaralharELimitar(situacoesFase3, 3);
        const comparacaoFonte = situacoesSorteadas.find((sit) => sit.comparacaoCustomizada)?.comparacaoCustomizada
            || this.obterComparacaoPadraoFase3();

        this.estado.idProvaSelecionada = null;

        this.estado.questoesSorteadas = {
            1: this.embaralharELimitar(fase1, this.config.quantidadePorFase[1]),
            2: fase2Ordenada,
            3: situacoesSorteadas.length ? [{ conteudo: situacoesSorteadas, comparacaoCustomizada: comparacaoFonte }] : [],
            4: this.embaralharELimitar(fase4, this.config.quantidadePorFase[4])
        };

        const faseInicial = [1, 2, 3, 4].find(f => (this.estado.questoesSorteadas[f] || []).length > 0);

        if (faseInicial && !(this.estado.questoesSorteadas[this.estado.faseAtiva] || []).length) {
            this.estado.faseAtiva = faseInicial;
            this.estado.situacaoIndice = 0;
            this.estado.naComparacao = false;
        }

        console.log('Simulado dinâmico sorteado por fases:', this.estado.questoesSorteadas);
    },

    questaoFase2TemImagem(questao = {}) {
        const audios = this.normalizarAudiosFase2(questao);
        return audios.some((audio) => String(audio.imageUrl || '').trim());
    },

    obterCandidatasFase2PorInteracao(interacao) {
        const fase2 = Array.isArray(this.dados.fase2) ? this.dados.fase2 : [];
        const numero = Number(interacao);
        const comImagem = fase2.filter((q) => this.questaoFase2TemImagem(q));
        const semImagem = fase2.filter((q) => !this.questaoFase2TemImagem(q));

        if ([1, 2, 3].includes(numero)) {
            const grupo123 = fase2.filter((q) => [1, 2, 3].includes(Number(q.interacao || 1)) && !this.questaoFase2TemImagem(q));
            return grupo123.length ? grupo123 : (semImagem.length ? semImagem : fase2);
        }

        if ([4, 5].includes(numero)) {
            const grupo45 = fase2.filter((q) => [4, 5].includes(Number(q.interacao || 4)) && this.questaoFase2TemImagem(q));
            return grupo45.length ? grupo45 : (comImagem.length ? comImagem : fase2.filter((q) => [4, 5].includes(Number(q.interacao || 0))));
        }

        return fase2;
    },

    obterPoolSituacoesFase3() {
        const fase3 = Array.isArray(this.dados.fase3) ? this.dados.fase3 : [];
        const pool = [];

        fase3.forEach((bloco, blocoIndex) => {
            const conteudo = Array.isArray(bloco?.conteudo) ? bloco.conteudo : [];

            conteudo.forEach((situacao, situacaoIndex) => {
                pool.push({
                    ...situacao,
                    idProva: situacao.idProva || bloco.idProva || '',
                    origemBlocoIndex: blocoIndex,
                    origemSituacaoIndex: situacaoIndex,
                    comparacaoCustomizada: bloco.comparacaoCustomizada || null
                });
            });
        });

        return pool;
    },

    obterComparacaoPadraoFase3() {
        const fase3 = Array.isArray(this.dados.fase3) ? this.dados.fase3 : [];
        const blocoComComparacao = fase3.find((bloco) => bloco?.comparacaoCustomizada);

        return blocoComComparacao?.comparacaoCustomizada || {
            perguntaHTML: 'Now, after listening to the 3 situations. Compare them in terms of severity, possible solutions or ways of prevention.',
            guiaAjudaHTML: '',
            modeloRespostaHTML: ''
        };
    },

    obterAssinaturaQuestao(questao = {}) {
        try {
            return JSON.stringify({
                id: questao.id || '',
                idProva: questao.idProva || '',
                interacao: questao.interacao || '',
                titulo: questao.tituloContexto || questao.scenario || questao.titulo || '',
                imageUrl: questao.imageUrl || '',
                audioUrl: questao.audioUrl || '',
                conteudo: Array.isArray(questao.conteudo) ? questao.conteudo.length : ''
            });
        } catch {
            return String(Math.random());
        }
    },

    sortearDiferente(lista = [], atual = null) {
        if (!Array.isArray(lista) || lista.length === 0) return null;
        if (lista.length === 1) return lista[0];

        const assinaturaAtual = this.obterAssinaturaQuestao(atual);
        const alternativas = lista.filter((item) => this.obterAssinaturaQuestao(item) !== assinaturaAtual);
        const pool = alternativas.length ? alternativas : lista;

        return this.embaralharELimitar(pool, 1)[0];
    },

    sortearQuestaoAtual(estadoTravado = null) {
        /*
            Refresh local:
            troca somente o item da página atual.
            A página atual vem do estadoTravado, para evitar qualquer variação
            durante o re-render.
        */

        const fase = Number(estadoTravado?.faseAtiva ?? this.estado.faseAtiva);
        const indice = Number(estadoTravado?.situacaoIndice ?? this.estado.situacaoIndice);
        const estaNaComparacao = Boolean(estadoTravado?.naComparacao ?? this.estado.naComparacao);

        if (fase === 1) {
            const lista = Array.isArray(this.dados.fase1) ? this.dados.fase1 : [];
            const atual = this.estado.questoesSorteadas[1]?.[indice];
            const sorteada = this.sortearDiferente(lista, atual);

            if (sorteada && this.estado.questoesSorteadas[1]) {
                this.estado.questoesSorteadas[1][indice] = { ...sorteada };
            }

            return;
        }

        if (fase === 2) {
            /*
                Fase 2:
                A interaction exibida é SEMPRE determinada pelo índice atual.
                índice 0 => Interaction 1
                índice 1 => Interaction 2
                índice 2 => Interaction 3
                índice 3 => Interaction 4
                índice 4 => Interaction 5

                Nunca usamos questao.interacao como fonte de navegação,
                pois esse campo pode vir inconsistente no banco.
            */
            const interactionAtual = indice + 1;
            const atual = this.estado.questoesSorteadas[2]?.[indice];
            const candidatas = this.obterCandidatasFase2PorInteracao(interactionAtual);
            const sorteada = this.sortearDiferente(candidatas, atual);

            if (sorteada && this.estado.questoesSorteadas[2]) {
                // Clonamos para não alterar o banco original em this.dados.
                this.estado.questoesSorteadas[2][indice] = {
                    ...sorteada,
                    interacao: interactionAtual
                };
            }

            return;
        }

        if (fase === 3) {
            const pool = this.obterPoolSituacoesFase3();
            const blocoAtual = this.estado.questoesSorteadas[3]?.[0];

            if (estaNaComparacao) {
                const situacoes = this.embaralharELimitar(pool, 3);
                if (situacoes.length) {
                    this.estado.questoesSorteadas[3] = [{
                        conteudo: situacoes,
                        comparacaoCustomizada: situacoes.find((sit) => sit.comparacaoCustomizada)?.comparacaoCustomizada || this.obterComparacaoPadraoFase3()
                    }];
                    this.estado.naComparacao = true;
                }
                return;
            }

            const atual = blocoAtual?.conteudo?.[indice];
            const sorteada = this.sortearDiferente(pool, atual);

            if (sorteada && blocoAtual?.conteudo) {
                blocoAtual.conteudo[indice] = { ...sorteada };
                if (sorteada.comparacaoCustomizada) {
                    blocoAtual.comparacaoCustomizada = sorteada.comparacaoCustomizada;
                }
                this.estado.situacaoIndice = indice;
                this.estado.naComparacao = false;
            }

            return;
        }

        if (fase === 4) {
            const lista = Array.isArray(this.dados.fase4) ? this.dados.fase4 : [];
            const atual = this.estado.questoesSorteadas[4]?.[indice];
            const sorteada = this.sortearDiferente(lista, atual);

            if (sorteada && this.estado.questoesSorteadas[4]) {
                this.estado.questoesSorteadas[4][indice] = { ...sorteada };
            }
        }
    },

    embaralharELimitar(listaOriginal, quantidadeLimite) {
        if (!listaOriginal || listaOriginal.length === 0) return [];
        const lista = [...listaOriginal];
        for (let i = lista.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lista[i], lista[j]] = [lista[j], lista[i]];
        }
        return lista.slice(0, quantidadeLimite);
    },

    scrollParaTopo() {
        /*
            Sempre que o aluno muda de etapa, interaction, situation,
            comparison, photo ou usa o refresh, a tela volta para o início
            do conteúdo da prova.
        */
        const alvo =
            document.getElementById('instrucao-fase-texto') ||
            document.querySelector('.simulador-master') ||
            document.getElementById('conteudo-card-dinamico');

        if (alvo && typeof alvo.scrollIntoView === 'function') {
            alvo.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            return;
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    },

    vincularEventosFases() {
        for (let i = 1; i <= 4; i++) {
            const btn = document.getElementById(`btn-fase-${i}`);
            if (btn) {
                btn.onclick = () => {
                    this.irParaPaginaAtual(i, 0, false);
                };
            }
        }

        const btnRefresh = document.getElementById('btn-refresh-simulado');
        if (btnRefresh) {
            btnRefresh.onclick = (e) => {
                e.preventDefault();

                /*
                    Refresh local definitivo:
                    - não chama gerarProvaSorteada();
                    - não reinicia a prova;
                    - não altera fase;
                    - não altera interaction/situation/photo;
                    - troca somente o conteúdo da página atual.
                */
                const estadoAntes = {
                    faseAtiva: this.estado.faseAtiva,
                    situacaoIndice: this.estado.situacaoIndice,
                    naComparacao: this.estado.naComparacao
                };

                this.sortearQuestaoAtual(estadoAntes);

                this.estado.faseAtiva = estadoAntes.faseAtiva;
                this.estado.situacaoIndice = estadoAntes.situacaoIndice;
                this.estado.naComparacao = estadoAntes.naComparacao;

                this.renderizarEstruturaCompleta();
                this.scrollParaTopo();
            };
        }

        document.getElementById('btn-proxima-etapa').onclick = () => this.avancarEtapa();
    },

    avancarEtapa() {
        const irParaProximaFaseComConteudo = () => {
            for (let fase = this.estado.faseAtiva + 1; fase <= 4; fase++) {
                const lista = this.estado.questoesSorteadas[fase] || [];

                if (Array.isArray(lista) && lista.length > 0) {
                    this.faseAtivaMudar(fase);
                    return;
                }
            }

            alert('Parabéns, Comandante! Você concluiu todas as etapas da avaliação ICAO com sucesso.');
            window.location.href = 'index.html';
        };

        if (this.estado.faseAtiva === 3) {
            const bloco = this.estado.questoesSorteadas[3]?.[0];
            const total = bloco?.conteudo?.length || 0;

            if (!this.estado.naComparacao && this.estado.situacaoIndice + 1 < total) {
                this.estado.situacaoIndice++;
                this.renderizarEstruturaCompleta();
                this.scrollParaTopo();
                return;
            }

            if (!this.estado.naComparacao) {
                this.estado.naComparacao = true;
                this.renderizarEstruturaCompleta();
                this.scrollParaTopo();
                return;
            }

            irParaProximaFaseComConteudo();
            return;
        }

        const total = (this.estado.questoesSorteadas[this.estado.faseAtiva] || []).length;

        if (this.estado.situacaoIndice + 1 < total) {
            this.estado.situacaoIndice++;
            this.estado.naComparacao = false;
            this.renderizarEstruturaCompleta();
            this.scrollParaTopo();
            return;
        }

        irParaProximaFaseComConteudo();
    },

    faseAtivaMudar(novaFase) {
        this.estado.faseAtiva = Number(novaFase);
        this.estado.situacaoIndice = 0;
        this.estado.naComparacao = false;
        this.renderizarEstruturaCompleta();
        this.scrollParaTopo();
    },

    gerarIdAudioSeguro(audioUrl = '') {
        const base = String(audioUrl || `${Date.now()}-${Math.random()}`)
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(-18);

        return `audio-${base || Math.random().toString(36).slice(2)}`;
    },

    formatarTempoAudio(segundos = 0) {
        if (!Number.isFinite(segundos) || segundos < 0) return '00:00';

        const min = Math.floor(segundos / 60);
        const sec = Math.floor(segundos % 60);

        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    },

    renderizarAudioPlayer(audioUrl = '', titulo = 'Audio') {
        if (!String(audioUrl || '').trim()) return '';

        const id = this.gerarIdAudioSeguro(audioUrl);

        return `
            <div class="chitero-audio-player"
                 data-player-id="${id}"
                 style="
                    width:100%;
                    display:flex;
                    justify-content:center;
                    align-items:center;
                    margin:18px auto 20px auto;
                 ">
                <div style="
                    width:100%;
                    max-width:460px;
                    background:#0b0b0b;
                    color:#ffffff;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:18px;
                    padding:14px 16px;
                    box-shadow:0 12px 30px rgba(0,0,0,.16);
                    box-sizing:border-box;
                    font-family:'Segoe UI', Helvetica, Arial, sans-serif;
                ">
                    <audio id="${id}" src="${audioUrl}" preload="metadata" style="display:none;"></audio>

                    <div style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:10px;
                        margin-bottom:12px;
                    ">
                        <div style="
                            min-width:0;
                            display:flex;
                            flex-direction:column;
                            gap:2px;
                        ">
                            <div style="
                                font-size:11px;
                                font-weight:900;
                                letter-spacing:.7px;
                                text-transform:uppercase;
                                color:#5EBBDE;
                                white-space:nowrap;
                                overflow:hidden;
                                text-overflow:ellipsis;
                            ">${titulo || 'Audio'}</div>
                            <div style="
                                font-size:11px;
                                color:#9ca3af;
                                line-height:1.2;
                            ">Controller audio</div>
                        </div>

                        <button type="button"
                                class="chitero-audio-play"
                                data-target="${id}"
                                aria-label="Play audio"
                                style="
                                    width:44px;
                                    height:44px;
                                    min-width:44px;
                                    border-radius:50%;
                                    border:none;
                                    background:#ffffff;
                                    color:#000000;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    cursor:pointer;
                                    font-size:17px;
                                    font-weight:900;
                                    box-shadow:0 8px 22px rgba(255,255,255,.12);
                                    transition:transform .18s ease, opacity .18s ease;
                                ">▶</button>
                    </div>

                    <input type="range"
                           class="chitero-audio-progress"
                           data-target="${id}"
                           min="0"
                           max="100"
                           value="0"
                           step="0.1"
                           aria-label="Audio progress"
                           style="
                                width:100%;
                                accent-color:#5EBBDE;
                                cursor:pointer;
                                margin:4px 0 8px 0;
                           ">

                    <div style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:10px;
                        font-size:11px;
                        color:#cbd5e1;
                        font-variant-numeric:tabular-nums;
                    ">
                        <span class="chitero-audio-current" data-target="${id}">00:00</span>
                        <span class="chitero-audio-duration" data-target="${id}">00:00</span>
                    </div>
                </div>
            </div>
        `;
    },

    ativarAudioPlayers() {
        const players = Array.from(document.querySelectorAll('.chitero-audio-player'));

        players.forEach((player) => {
            if (player.dataset.inicializado === 'true') return;
            player.dataset.inicializado = 'true';

            const audio = player.querySelector('audio');
            const playBtn = player.querySelector('.chitero-audio-play');
            const progress = player.querySelector('.chitero-audio-progress');
            const current = player.querySelector('.chitero-audio-current');
            const duration = player.querySelector('.chitero-audio-duration');

            if (!audio || !playBtn || !progress) return;

            const atualizarBotao = () => {
                playBtn.innerText = audio.paused ? '▶' : '❚❚';
                playBtn.setAttribute('aria-label', audio.paused ? 'Play audio' : 'Pause audio');
            };

            const atualizarTempos = () => {
                if (current) current.innerText = this.formatarTempoAudio(audio.currentTime || 0);

                if (duration) {
                    duration.innerText = this.formatarTempoAudio(audio.duration || 0);
                }

                if (Number.isFinite(audio.duration) && audio.duration > 0) {
                    progress.value = String((audio.currentTime / audio.duration) * 100);
                } else {
                    progress.value = '0';
                }
            };

            playBtn.addEventListener('mouseenter', () => {
                playBtn.style.transform = 'scale(1.05)';
            });

            playBtn.addEventListener('mouseleave', () => {
                playBtn.style.transform = 'scale(1)';
            });

            playBtn.addEventListener('click', async () => {
                try {
                    const outrosAudios = Array.from(document.querySelectorAll('.chitero-audio-player audio'))
                        .filter((item) => item !== audio);

                    outrosAudios.forEach((item) => {
                        item.pause();
                        const outroPlayer = item.closest('.chitero-audio-player');
                        const outroBtn = outroPlayer?.querySelector('.chitero-audio-play');
                        if (outroBtn) {
                            outroBtn.innerText = '▶';
                            outroBtn.setAttribute('aria-label', 'Play audio');
                        }
                    });

                    if (audio.paused) {
                        await audio.play();
                    } else {
                        audio.pause();
                    }

                    atualizarBotao();
                } catch (erro) {
                    console.warn('Não foi possível reproduzir o áudio.', erro);
                }
            });

            progress.addEventListener('input', () => {
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

                const percentual = Number(progress.value || 0);
                audio.currentTime = (percentual / 100) * audio.duration;
                atualizarTempos();
            });

            audio.addEventListener('loadedmetadata', atualizarTempos);
            audio.addEventListener('timeupdate', atualizarTempos);
            audio.addEventListener('play', atualizarBotao);
            audio.addEventListener('pause', atualizarBotao);
            audio.addEventListener('ended', () => {
                audio.currentTime = 0;
                atualizarBotao();
                atualizarTempos();
            });

            atualizarBotao();
            atualizarTempos();
        });
    },

    gerarCollapseHTML(titulo, conteudoHtml, marginStyle = '12px 0') {
        if (!String(conteudoHtml || '').trim()) return '';
        return `
            <details style="margin: ${marginStyle}; border: 1px solid #eaeaea; border-radius: 6px; background: #fafafa; transition: background 0.2s;">
                <summary style="padding: 12px; font-size: 13px; font-weight: bold; color: #555; cursor: pointer; user-select: none; text-transform: uppercase; letter-spacing: 0.5px;">${titulo}</summary>
                <div style="padding: 15px; border-top: 1px solid #eaeaea; background: #ffffff; color: #222; font-size: 14px; line-height: 1.6;">${conteudoHtml}</div>
            </details>
        `;
    },

    renderizarEstruturaCompleta() {
        /*
            Renderização pura:
            este método NÃO deve alterar faseAtiva, situacaoIndice ou naComparacao.
            Ele apenas lê o estado e desenha a tela.
        */
        this.atualizarIconesFases();
        this.atualizarTextoInstrucao();
        this.renderizarPilulas();

        const miolo = document.getElementById('conteudo-card-dinamico');
        if (!miolo) return;

        if (this.estado.faseAtiva === 3) {
            const blocoFase3 = this.estado.questoesSorteadas[3]?.[0];

            if (!blocoFase3) {
                miolo.innerHTML = `<p style="text-align:center;color:#666;padding:20px;">No questions generated for this stage.</p>`;
                return;
            }

            if (this.estado.naComparacao) {
                this.renderizarComparacaoFase3(miolo);
                return;
            }

            this.renderizarFase3(miolo, blocoFase3);
            return;
        }

        const lista = this.estado.questoesSorteadas[this.estado.faseAtiva] || [];
        const questaoAtual = lista[this.estado.situacaoIndice];

        if (!questaoAtual) {
            miolo.innerHTML = `<p style="text-align:center;color:#666;padding:20px;">No questions generated for this stage.</p>`;
            return;
        }

        if (this.estado.faseAtiva === 1) {
            this.renderizarFase1(miolo, questaoAtual);
            return;
        }

        if (this.estado.faseAtiva === 2) {
            this.renderizarFase2(miolo, questaoAtual);
            return;
        }

        if (this.estado.faseAtiva === 4) {
            this.renderizarFase4(miolo, questaoAtual);
        }
    },

    atualizarIconesFases() {
        for (let i = 1; i <= 4; i++) {
            const btn = document.getElementById(`btn-fase-${i}`)?.querySelector('.icon-circle');
            if (!btn) continue;
            btn.style.background = i === this.estado.faseAtiva ? '#000' : '#e0e0e0';
            btn.style.color = i === this.estado.faseAtiva ? '#fff' : '#000';
        }
    },

    atualizarTextoInstrucao() {
        const box = document.getElementById('instrucao-fase-texto');
        if (!box) return;
        const textos = {
            1: '<strong>Part 1: Aviation Topics</strong> - Answer the questions relative to background, preparation and routine flight duties.',
            2: '<strong>Part 2: Interacting as a Pilot</strong> - Listen to the controller and interact accordingly. Your call sign is ANAC123.',
            3: '<strong>Part 3: Unexpected Situations</strong> - You will listen to three different communications. At the end, you will be required to compare them. Please take notes.',
            4: '<strong>Part 4: Picture Description</strong> - Picture description and operational report.'
        };
        box.innerHTML = textos[this.estado.faseAtiva] || '';
    },

    renderizarPilulas() {
        const container = document.getElementById('pilulas-navegacao-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.estado.faseAtiva === 3) {
            const bloco = this.estado.questoesSorteadas[3]?.[0];
            const total = bloco?.conteudo?.length || 0;

            for (let idx = 0; idx < total; idx++) {
                this.criarPilula(
                    container,
                    `${idx + 1}`,
                    idx,
                    !this.estado.naComparacao && idx === this.estado.situacaoIndice,
                    () => this.irParaPaginaAtual(3, idx, false)
                );
            }

            this.criarPilula(
                container,
                'comparison',
                '',
                this.estado.naComparacao,
                () => this.irParaPaginaAtual(3, this.estado.situacaoIndice, true)
            );

            return;
        }

        const lista = this.estado.questoesSorteadas[this.estado.faseAtiva] || [];
        const prefixo = this.estado.faseAtiva === 4
            ? 'Photo'
            : this.estado.faseAtiva === 2
                ? ''
                : '';

        lista.forEach((_, idx) => {
            this.criarPilula(
                container,
                `${prefixo} ${idx + 1}`,
                idx,
                idx === this.estado.situacaoIndice,
                () => this.irParaPaginaAtual(this.estado.faseAtiva, idx, false)
            );
        });
    },

    irParaPaginaAtual(fase, indice, naComparacao = false) {
        /*
            Navegação centralizada:
            qualquer clique nas pílulas passa por aqui.
            Isso evita que refresh/renderização alterem a página atual.
        */
        this.estado.faseAtiva = Number(fase);
        this.estado.situacaoIndice = Number(indice) || 0;
        this.estado.naComparacao = Boolean(naComparacao);
        this.renderizarEstruturaCompleta();
        this.scrollParaTopo();
    },

    criarPilula(container, texto, idx, ativo, onClick) {
        const pilula = document.createElement('button');
        pilula.innerText = texto;
        pilula.style.cssText = `padding: 5px 15px; border-radius: 20px; border: 1px solid ${ativo ? '#000' : '#ddd'}; background: ${ativo ? '#000' : '#fff'}; color: ${ativo ? '#fff' : '#111'}; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;`;
        pilula.onclick = onClick;
        container.appendChild(pilula);
    },

    normalizarAudiosFase2(questao = {}) {
        if (Array.isArray(questao.audios)) {
            return questao.audios.map((audio, idx) => ({
                titulo: audio.titulo || audio.title || `AUDIO ${idx + 1}`,
                audioUrl: audio.audioUrl || '',
                imageUrl: audio.imageUrl || '',
                transcript: audio.transcript || audio.transcricao || '',
                model: audio.model || '',
                problem: audio.problem || '',
                modelAnswer: audio.modelAnswer || audio.respostaModelo || '',
                controllerQuestion: audio.controllerQuestion || audio.perguntaFinal || '',
                controllerAnswer: audio.controllerAnswer || audio.respostaFinal || ''
            }));
        }

        return (questao.conteudo || []).map((bloco, idx) => ({
            titulo: bloco.tituloAudio || bloco.label || `AUDIO ${idx + 1}`,
            audioUrl: bloco.audioUrl || '',
            imageUrl: bloco.imageUrl || '',
            transcript: bloco.transcript || bloco.transcricao || '',
            model: bloco.model || '',
            problem: bloco.problem || bloco.perguntaFinal || '',
            modelAnswer: bloco.modelAnswer || bloco.respostaFinal || '',
            controllerQuestion: bloco.controllerQuestion || '',
            controllerAnswer: bloco.controllerAnswer || ''
        }));
    },

    renderizarFase1(miolo, questao) {
        miolo.innerHTML = `
            <h2 style="font-size:24px;font-weight:700;text-align:center;margin:20px 0 30px;line-height:1.4;">${questao.tituloContexto || ''}</h2>
            ${this.gerarCollapseHTML('Model Answer', questao.modeloResposta || '')}
        `;
    },

    renderizarFase2(miolo, questao) {
        const audios = this.normalizarAudiosFase2(questao);
        const scenario = questao.scenario || questao.cenario || questao.tituloContexto || '';
        /*
            A interação visual/controladora é sempre baseada na página atual,
            não no campo questao.interacao.
        */
        const interacao = this.estado.situacaoIndice + 1;
        let html = `<div class="fluxo-linear-container">`;

        if (scenario) {
            html += `
                <div style="text-align:center;margin-bottom:30px;">
                    <h3 style="font-size:18px;font-weight:800;color:#111;margin:0 0 12px;text-transform:uppercase;">Scenario</h3>
                    <p style="font-size:17px;font-weight:600;color:#111;line-height:1.55;margin:0 auto;max-width:760px;">${scenario}</p>
                </div>
            `;
        }

        audios.forEach((audio, idx) => {
            if (idx > 0) {
                html += `<div style="display:flex;justify-content:center;margin:28px 0;"><div style="width:30px;height:30px;border-radius:50%;border:2px solid #00a8cc;display:flex;align-items:center;justify-content:center;color:#00a8cc;font-weight:bold;">↓</div></div>`;
            }

            html += `<div class="sub-bloco-evento" style="border-left:3px solid #000;padding-left:20px;margin-bottom:28px;">`;

            if (audio.titulo) {
                html += `<div style="font-size:13px;font-weight:900;color:#111;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px;">${audio.titulo}</div>`;
            }

            if (audio.audioUrl) {
                html += this.renderizarAudioPlayer(audio.audioUrl, audio.titulo || `Audio ${idx + 1}`);
            }

            if (audio.transcript) html += this.gerarCollapseHTML(idx === 0 ? 'Transcript' : `Transcript ${idx + 1}`, `<span style="font-family:monospace;">${audio.transcript}</span>`);
            if (audio.model) html += this.gerarCollapseHTML('Model', audio.model);

            const imagemPermitida = [4, 5].includes(Number(interacao));

            /*
                Fluxo correto das interações 4 e 5:
                PROBLEM / NOW DURING THE APPROACH...
                ↓
                IMAGEM
                ↓
                MODEL ANSWER

                Nas interações 1, 2 e 3, mantém o fluxo tradicional sem imagem.
            */
            if (audio.problem) {
                html += `<div style="margin-top:24px;padding-top:18px;border-top:1px dashed #ddd;text-align:center;"><h3 style="font-size:16px;font-weight:800;margin:0;color:#111;line-height:1.45;">${audio.problem}</h3></div>`;
            }

            if (audio.imageUrl && imagemPermitida) {
                html += `<div style="margin:20px 0;text-align:center;"><img src="${audio.imageUrl}" alt="Documentação do evento" style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);border:1px solid #eee;"></div>`;
            }

            if (audio.modelAnswer) html += this.gerarCollapseHTML('Model Answer', audio.modelAnswer);

            const controllerQuestion = String(audio.controllerQuestion || '').trim();
            const controllerAnswer = String(audio.controllerAnswer || '').trim();
            if (controllerQuestion || controllerAnswer) {
                html += `<div style="margin-top:25px;padding-top:20px;border-top:1px dashed #ddd;text-align:center;">
                    <h4 style="font-size:18px;font-weight:800;color:#000;margin-bottom:12px;">${controllerQuestion || 'What did the controller say?'}</h4>
                    ${controllerAnswer ? this.gerarCollapseHTML('Answer', controllerAnswer) : ''}
                </div>`;
            }

            html += `</div>`;
        });

        html += `</div>`;
        miolo.innerHTML = html;
        this.ativarAudioPlayers();
    },

    renderizarFase3(miolo, bloco) {
        const item = bloco?.conteudo?.[this.estado.situacaoIndice];
        if (!item) {
            miolo.innerHTML = `<p style="text-align:center;color:#666;padding:20px;">Error loading situation.</p>`;
            return;
        }

        let html = `<div class="sub-bloco-evento" style="border-left:3px solid #000;padding-left:20px;margin-bottom:10px;">`;
        html += `<h3 style="font-size:17px;font-weight:700;margin-bottom:15px;color:#111;line-height:1.5;">${item.titulo || `Situation ${this.estado.situacaoIndice + 1}`}</h3>`;
        if (item.audioUrl) html += this.renderizarAudioPlayer(item.audioUrl, `Situation ${this.estado.situacaoIndice + 1}`);
        if (item.transcricao) html += this.gerarCollapseHTML('Transcript', `<span style="font-family:monospace;">${item.transcricao}</span>`);
        if (item.model) html += this.gerarCollapseHTML('Model', item.model);
        if (item.perguntaFinal) html += `<div style="margin-top:24px;padding-top:18px;border-top:1px dashed #ddd;text-align:center;"><h3 style="font-size:18px;font-weight:800;color:#111;line-height:1.45;">${item.perguntaFinal}</h3></div>`;
        if (item.respostaFinal) html += this.gerarCollapseHTML('Answer', item.respostaFinal);
        html += `</div>`;
        miolo.innerHTML = html;
        this.ativarAudioPlayers();
    },

    renderizarComparacaoFase3(miolo) {
        const bloco = this.estado.questoesSorteadas[3]?.[0];
        const comp = bloco?.comparacaoCustomizada || {};
        const pergunta = comp.perguntaHTML || comp.pergunta || 'Now, after listening to the 3 situations. Compare them in terms of severity, possible solutions or ways of prevention.';
        miolo.innerHTML = `
            <div style="text-align:left;line-height:1.8;color:#333;">
                <p style="font-weight:500;text-align:center;color:#555;margin-bottom:25px;">Now, after listening to these three situations:</p>
                <h3 style="font-weight:bold;text-align:center;color:#111;margin-bottom:30px;line-height:1.5;">${pergunta}</h3>
                ${comp.guiaAjudaHTML ? `<div style="background:#fdfdfd;border:1px solid #f0f0f0;border-radius:12px;padding:25px;margin-top:20px;">${comp.guiaAjudaHTML}</div>` : ''}
            </div>
        `;
    },

    renderizarFase4(miolo, questao) {
        const imagem = questao.imageUrl || '';
        let html = `<div class="fase4-layout-container" style="text-align:left;">`;

        if (imagem) {
            html += `<div style="position:relative;width:100%;text-align:center;margin-bottom:25px;border-radius:8px;overflow:hidden;border:1px solid #eaeaea;"><img src="${imagem}" alt="ICAO Picture Evaluation" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto;"></div>`;
        }

        if (questao.descricaoHtml) html += `<div style="margin-bottom:40px;">${this.gerarCollapseHTML('Description', questao.descricaoHtml)}</div>`;

        (questao.perguntas || []).forEach((p, idx) => {
            html += `<div class="bloco-pergunta-fase4" style="text-align:center;margin-bottom:30px;">
                <h4 style="font-size:18px;font-weight:700;color:#111;margin-bottom:12px;">${p.perguntaTexto || ''}</h4>
                ${this.gerarCollapseHTML('Answer', p.respostaTexto || '')}
                ${idx < (questao.perguntas || []).length - 1 ? '<div style="width:80px;margin:30px auto 20px;border-top:2px dotted #ccc;"></div>' : ''}
            </div>`;
        });

        if (questao.statement) {
            html += `<div style="width:120px;margin:40px auto 30px;border-top:2px dotted #aaa;"></div>
                <div class="bloco-statement-fase4" style="text-align:center;margin-top:20px;">
                    <h3 style="font-size:19px;font-weight:800;color:#222;text-transform:uppercase;margin-bottom:5px;letter-spacing:.5px;">Statement</h3>
                    <p style="font-size:14px;color:#666;margin-bottom:20px;">Tell me to which extent you agree or disagree with this statement</p>
                    <h2 style="font-size:21px;font-weight:800;color:#0b1a30;line-height:1.4;max-width:750px;margin:0 auto 30px;">${questao.statement.textoAfirmacao || ''}</h2>
                    <div style="text-align:left;max-width:800px;margin:0 auto;">
                        ${this.gerarCollapseHTML('I Agree ✅', questao.statement.agreeTexto || '', '15px 0')}
                        ${this.gerarCollapseHTML('I Disagree ❌', questao.statement.disagreeTexto || '', '15px 0')}
                    </div>
                </div>`;
        }

        html += `</div>`;
        miolo.innerHTML = html;
    }
};
