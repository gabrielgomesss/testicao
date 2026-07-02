// js/views/view-simulado.js
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db } from '../firebase-config.js';

export const ViewSimulado = {
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
            Novo modelo:
            Não sorteamos mais uma prova inteira.
            Agora o simulado é montado a partir do banco completo de questões:
            - Fase 1: sorteia 3 questões de todo o banco;
            - Fase 2: sorteia 1 questão para cada Interaction 1, 2, 3, 4 e 5;
            - Fase 3: sorteia 1 bloco completo;
            - Fase 4: sorteia 1 photo.
        */

        const fase1 = Array.isArray(this.dados.fase1) ? this.dados.fase1 : [];
        const fase3 = Array.isArray(this.dados.fase3) ? this.dados.fase3 : [];
        const fase4 = Array.isArray(this.dados.fase4) ? this.dados.fase4 : [];

        const fase2Ordenada = [];

        for (let interacao = 1; interacao <= 5; interacao++) {
            const candidatas = this.obterCandidatasFase2PorInteracao(interacao);

            if (candidatas.length) {
                fase2Ordenada.push(this.embaralharELimitar(candidatas, 1)[0]);
            } else {
                console.warn(`Nenhuma questão encontrada para a Fase 2, Interaction ${interacao}.`);
            }
        }

        this.estado.idProvaSelecionada = null;

        this.estado.questoesSorteadas = {
            1: this.embaralharELimitar(fase1, this.config.quantidadePorFase[1]),
            2: fase2Ordenada,
            3: this.embaralharELimitar(fase3, this.config.quantidadePorFase[3]),
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

    obterCandidatasFase2PorInteracao(interacao) {
        const fase2 = Array.isArray(this.dados.fase2) ? this.dados.fase2 : [];
        const numero = Number(interacao);

        let candidatas = fase2.filter((q) => Number(q.interacao) === numero);

        /*
            Regra mantida:
            Interaction 4 e 5 continuam sendo as interações com imagem.
            Então priorizamos questões que possuam imageUrl no problem.
        */
        if ([4, 5].includes(numero)) {
            const comImagem = candidatas.filter((q) => {
                const audios = this.normalizarAudiosFase2(q);
                return audios.some((audio) => String(audio.imageUrl || '').trim());
            });

            if (comImagem.length) {
                candidatas = comImagem;
            }
        }

        return candidatas;
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
            /*
                Se estiver na Comparison, o refresh sorteia outro bloco inteiro
                e mantém o usuário na Comparison.
                Se estiver em uma Situation, sorteia outro bloco e mantém o
                mesmo índice de situation, quando existir.
            */
            const lista = Array.isArray(this.dados.fase3) ? this.dados.fase3 : [];
            const atual = this.estado.questoesSorteadas[3]?.[0];
            const sorteada = this.sortearDiferente(lista, atual);

            if (sorteada) {
                this.estado.questoesSorteadas[3] = [{ ...sorteada }];

                const totalSituacoes = Array.isArray(sorteada.conteudo) ? sorteada.conteudo.length : 0;

                if (!estaNaComparacao && totalSituacoes > 0) {
                    this.estado.situacaoIndice = Math.min(indice, totalSituacoes - 1);
                }

                this.estado.naComparacao = estaNaComparacao;
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
        pilula.style.cssText = `padding: 10px 24px; border-radius: 20px; border: 1px solid ${ativo ? '#000' : '#ddd'}; background: ${ativo ? '#000' : '#fff'}; color: ${ativo ? '#fff' : '#111'}; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;`;
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
