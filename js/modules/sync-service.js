// js/modules/sync-service.js

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { dadosSimulado } from '../../assets/data/perguntas.js';
import { db } from '../firebase-config.js';

const CACHE_PROVAS_KEY = 'dados_simulado_cache';
const CACHE_META_KEY = 'dados_simulado_cache_meta';
const CACHE_VERSION = 4;
const OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

function agoraISO() {
    return new Date().toISOString();
}

function mais24hISO() {
    return new Date(Date.now() + OFFLINE_WINDOW_MS).toISOString();
}

function lerJSON(chave) {
    try {
        const valor = localStorage.getItem(chave);
        return valor ? JSON.parse(valor) : null;
    } catch (erro) {
        console.warn(`Cache inválido em ${chave}. Limpando.`, erro);
        localStorage.removeItem(chave);
        return null;
    }
}

function salvarJSON(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
}


function gerarAssinaturaBanco(banco) {
    try {
        return JSON.stringify(banco || {}).length + ':' + btoa(unescape(encodeURIComponent(JSON.stringify(banco || {})))).slice(0, 48);
    } catch {
        return `${Date.now()}`;
    }
}

function obterAssinaturaCacheAtual() {
    const meta = lerJSON(CACHE_META_KEY);
    return meta?.assinaturaBanco || null;
}

function notificarAtualizacaoProvas(detalhes = {}) {
    try {
        window.dispatchEvent(new CustomEvent('chiteroicao-provas-atualizadas', {
            detail: detalhes
        }));
    } catch (erro) {
        console.warn('Não foi possível notificar atualização de provas.', erro);
    }
}

/**
 * Normaliza caminhos de mídia para que o Service Worker consiga cachear tanto:
 * - URLs absolutas do Firebase Storage/http(s)
 * - caminhos locais vindos do perguntas.js: assets/..., ./assets/... ou /assets/...
 */
function normalizarUrlMidia(valor) {
    if (typeof valor !== 'string') return null;

    const texto = valor.trim();
    if (!texto) return null;

    const possuiExtensaoMidia = /\.(mp3|wav|ogg|m4a|aac|mp4|webm|mov|jpg|jpeg|png|webp|avif)(\?|#|$)/i.test(texto);
    const isFirebaseStorage = texto.includes('firebasestorage.googleapis.com');
    const isHttp = /^https?:\/\//i.test(texto);
    const isLocalAssets = texto.startsWith('assets/') || texto.startsWith('./assets/') || texto.startsWith('/assets/');

    if (!((possuiExtensaoMidia || isFirebaseStorage) && (isHttp || isLocalAssets))) {
        return null;
    }

    if (isHttp) return texto;

    // Service Worker está na raiz do projeto. Padronizamos caminhos locais como ./assets/...
    if (texto.startsWith('./assets/')) return texto;
    if (texto.startsWith('/assets/')) return `.${texto}`;
    if (texto.startsWith('assets/')) return `./${texto}`;

    return texto;
}

function coletarUrlsMidia(objeto, urls = new Set()) {
    if (!objeto) return urls;

    if (Array.isArray(objeto)) {
        objeto.forEach((item) => coletarUrlsMidia(item, urls));
        return urls;
    }

    if (typeof objeto === 'object') {
        Object.values(objeto).forEach((valor) => coletarUrlsMidia(valor, urls));
        return urls;
    }

    const urlNormalizada = normalizarUrlMidia(objeto);
    if (urlNormalizada) {
        urls.add(urlNormalizada);
    }

    return urls;
}

function bancoEstaVazio(banco) {
    if (!banco) return true;

    if (Array.isArray(banco)) return banco.length === 0;

    if (banco.provas && Array.isArray(banco.provas)) {
        return banco.provas.length === 0;
    }

    return ['fase1', 'fase2', 'fase3', 'fase4'].every((fase) => {
        return !Array.isArray(banco[fase]) || banco[fase].length === 0;
    });
}

async function buscarModeloNovoProvas() {
    const provasRef = collection(db, 'provas');
    let snapshot;

    try {
        snapshot = await getDocs(query(provasRef, where('ativa', '==', true)));
    } catch (erro) {
        console.warn('Não foi possível aplicar filtro ativa==true. Buscando todas as provas.', erro);
        snapshot = await getDocs(provasRef);
    }

    const provas = [];
    snapshot.forEach((docSnap) => {
        provas.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    return {
        modelo: 'provas',
        provas
    };
}

async function buscarModeloLegadoFases() {
    const bancoDinamico = {
        fase1: [],
        fase2: [],
        fase3: [],
        fase4: []
    };

    for (let i = 1; i <= 4; i++) {
        const querySnapshot = await getDocs(collection(db, `fase${i}`));
        querySnapshot.forEach((docSnap) => {
            bancoDinamico[`fase${i}`].push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
    }

    return {
        modelo: 'fases_legado',
        ...bancoDinamico
    };
}

async function avisarServiceWorkerParaCachear(urls) {
    const lista = Array.from(new Set(urls)).filter(Boolean);

    if (!('serviceWorker' in navigator) || lista.length === 0) {
        return { solicitadas: 0 };
    }

    const payload = {
        type: 'CACHEAR_PROVAS_DINAMICAS',
        urls: lista
    };

    const enviarMensagem = (worker) => {
        try {
            worker?.postMessage(payload);
        } catch (erro) {
            console.warn('Não foi possível enviar mídias ao Service Worker.', erro);
        }
    };

    if (navigator.serviceWorker.controller) {
        enviarMensagem(navigator.serviceWorker.controller);
        return { solicitadas: lista.length };
    }

    const registration = await navigator.serviceWorker.ready;
    enviarMensagem(registration.active || registration.waiting || registration.installing);

    return { solicitadas: lista.length };
}

const CACHE_MIDIA_CLIENTE = 'chiteroicao-dynamic-midia-v1';

function isFirebaseStorageUrl(url) {
    try {
        const u = new URL(url, window.location.href);
        return u.hostname.includes('firebasestorage.googleapis.com') || u.hostname.includes('storage.googleapis.com');
    } catch {
        return false;
    }
}

function mesmaMidiaPorPathname(urlA, urlB) {
    try {
        const a = new URL(urlA, window.location.href);
        const b = new URL(urlB, window.location.href);

        return a.origin === b.origin && a.pathname === b.pathname;
    } catch {
        return false;
    }
}

function emitirProgressoCacheMidia(payload = {}) {
    try {
        window.dispatchEvent(new CustomEvent('chiteroicao-cache-progress', {
            detail: payload
        }));
    } catch (erro) {
        console.warn('Não foi possível emitir progresso do cache de mídia.', erro);
    }
}

async function urlJaCacheadaEmQualquerCache(url) {
    if (!('caches' in window)) return false;

    try {
        const nomes = await caches.keys();

        for (const nome of nomes) {
            const cache = await caches.open(nome);

            const direto = await cache.match(url, { ignoreSearch: false, ignoreVary: true });
            if (direto) return true;

            const semQuery = await cache.match(url, { ignoreSearch: true, ignoreVary: true });
            if (semQuery) return true;

            const requestKeys = await cache.keys();
            const encontrado = requestKeys.some((request) => {
                if (request.url === url) return true;
                return mesmaMidiaPorPathname(url, request.url);
            });

            if (encontrado) return true;
        }
    } catch (erro) {
        console.warn('Falha ao verificar mídia no cache.', erro);
    }

    return false;
}

async function fetchComTimeout(url, timeoutMs = 65000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const request = new Request(url, {
            method: 'GET',
            credentials: isFirebaseStorageUrl(url) ? 'omit' : 'same-origin',
            cache: 'reload',
            mode: isFirebaseStorageUrl(url) ? 'cors' : 'same-origin',
            signal: controller.signal
        });

        return await fetch(request);
    } finally {
        clearTimeout(timer);
    }
}

async function cachearMidiasNoCliente(urls = []) {
    const lista = Array.from(new Set((urls || []).filter(Boolean)));
    const total = lista.length;

    if (!total) {
        emitirProgressoCacheMidia({
            type: 'CACHE_PROGRESS',
            origem: 'cliente',
            total: 0,
            processados: 0,
            cacheados: 0,
            falhas: 0,
            concluido: true
        });
        return { solicitadas: 0, cacheadas: 0, falhas: 0 };
    }

    if (!('caches' in window)) {
        // Fallback para navegadores em que a Cache API do window não esteja disponível.
        const resultadoSW = await avisarServiceWorkerParaCachear(lista);
        return { solicitadas: resultadoSW.solicitadas, cacheadas: 0, falhas: 0, fallbackSW: true };
    }

    const cache = await caches.open(CACHE_MIDIA_CLIENTE);
    const falharam = [];
    let processados = 0;
    let cacheados = 0;
    let falhas = 0;

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    const CONCORRENCIA = isMobile ? 1 : 3;

    const emitir = (extra = {}) => {
        emitirProgressoCacheMidia({
            type: 'CACHE_PROGRESS',
            origem: 'cliente',
            total,
            processados,
            cacheados,
            falhas,
            concluido: processados >= total && falharam.length === 0,
            ...extra
        });
    };

    emitir({ status: 'iniciando' });

    async function baixarComRetentativa(url, rodada = 1) {
        if (await urlJaCacheadaEmQualquerCache(url)) {
            cacheados += 1;
            processados += 1;
            emitir({ status: 'ja-cacheado', urlAtual: url });
            return true;
        }

        let ultimoErro = null;
        const maxTentativas = rodada === 1 ? 3 : 2;

        for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
            try {
                emitir({ status: tentativa > 1 ? `tentativa-${tentativa}` : 'baixando', urlAtual: url });

                const response = await fetchComTimeout(url, isMobile ? 90000 : 60000);

                if (response && (response.ok || response.status === 200 || response.type === 'opaque')) {
                    await cache.put(url, response.clone());
                    cacheados += 1;
                    processados += 1;
                    emitir({ status: 'cacheado', urlAtual: url });
                    return true;
                }

                ultimoErro = new Error(`Resposta HTTP ${response?.status || 'sem status'}`);
            } catch (erro) {
                ultimoErro = erro;
                console.warn(`⚠️ Cache mídia tentativa ${tentativa}/${maxTentativas} falhou:`, url, erro);
            }

            await new Promise((resolve) => setTimeout(resolve, isMobile ? 1200 * tentativa : 500 * tentativa));
        }

        console.warn('⚠️ Mídia falhou e será reenfileirada:', url, ultimoErro);
        return false;
    }

    let cursor = 0;

    async function worker() {
        while (cursor < lista.length) {
            const indexAtual = cursor;
            cursor += 1;
            const url = lista[indexAtual];

            const ok = await baixarComRetentativa(url, 1);
            if (!ok) {
                falharam.push(url);
                falhas += 1;
                processados += 1;
                emitir({ status: 'falha-temporaria', urlAtual: url });
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, lista.length) }, () => worker()));

    // Segunda rodada: tenta novamente apenas os que falharam, sem travar a fila principal.
    if (falharam.length > 0 && navigator.onLine) {
        const retryList = falharam.splice(0, falharam.length);
        falhas = 0;
        processados = Math.max(0, total - retryList.length);
        emitir({ status: 'retentativa-final', urlAtual: '' });

        for (const url of retryList) {
            const ok = await baixarComRetentativa(url, 2);
            if (!ok) {
                falhas += 1;
                processados += 1;
                emitir({ status: 'falha-final', urlAtual: url });
            }
        }
    }

    emitir({
        status: falhas > 0 ? 'concluido-com-falhas' : 'concluido',
        concluido: true,
        urlAtual: ''
    });

    return {
        solicitadas: total,
        cacheadas: cacheados,
        falhas
    };
}

async function salvarBancoNoCache(banco, modelo) {
    const urlsMidia = Array.from(coletarUrlsMidia(banco));
    const assinaturaAnterior = obterAssinaturaCacheAtual();
    const assinaturaBanco = gerarAssinaturaBanco(banco);
    const houveMudanca = assinaturaAnterior !== assinaturaBanco;

    salvarJSON(CACHE_PROVAS_KEY, banco);
    salvarJSON(CACHE_META_KEY, {
        versaoCache: CACHE_VERSION,
        modelo,
        sincronizadoEm: agoraISO(),
        validoAte: mais24hISO(),
        totalMidias: urlsMidia.length,
        assinaturaBanco
    });

    if (houveMudanca) {
        localStorage.removeItem('chiteroicao_cache_offline_confirmado');
    }

    const resultadoMidia = await cachearMidiasNoCliente(urlsMidia);

    console.log(`📦 Cache de provas salvo. Modelo: ${modelo}. Mudança detectada: ${houveMudanca ? 'sim' : 'não'}.`);
    console.log(`🎧 Cache de mídia executado: ${resultadoMidia.cacheadas || 0}/${resultadoMidia.solicitadas || urlsMidia.length}. Falhas: ${resultadoMidia.falhas || 0}.`);

    notificarAtualizacaoProvas({
        modelo,
        houveMudanca,
        totalMidias: urlsMidia.length,
        midiasSolicitadas: resultadoMidia.solicitadas || urlsMidia.length,
        midiasCacheadas: resultadoMidia.cacheadas || 0,
        falhasMidia: resultadoMidia.falhas || 0
    });

    return {
        urlsMidia,
        midiasSolicitadas: resultadoMidia.solicitadas || urlsMidia.length,
        midiasCacheadas: resultadoMidia.cacheadas || 0,
        falhasMidia: resultadoMidia.falhas || 0,
        houveMudanca
    };
}

export const SyncService = {
    async sincronizarProvas({ forcar = false } = {}) {
        if (!navigator.onLine) {
            console.log('✈️ Sincronizador: dispositivo offline. Usando cache local existente.');
            return {
                sucesso: this.existeCacheValido(),
                origem: 'offline-cache',
                cacheValido: this.existeCacheValido()
            };
        }

        /*
            Online-first:
            quando há internet, o Firestore sempre é a fonte da verdade.
            O cache de 24h só é usado como fallback offline ou caso a busca online falhe.
            Isso garante que alterações feitas no Admin apareçam para o aluno sem limpar cache.
        */

        try {
            console.log('🔄 Sincronizador: buscando provas no Firestore...');

            let banco = await buscarModeloNovoProvas();

            if (bancoEstaVazio(banco)) {
                console.log('ℹ️ Coleção provas vazia. Tentando modelo legado fase1/fase2/fase3/fase4.');
                banco = await buscarModeloLegadoFases();
            }

            if (bancoEstaVazio(banco)) {
                console.log('📘 Firestore vazio. Utilizando perguntas.js como fonte temporária.');

                banco = {
                    modelo: 'perguntas_js',
                    ...dadosSimulado
                };

                const resultadoCache = await salvarBancoNoCache(banco, 'perguntas_js');

                return {
                    sucesso: true,
                    origem: 'perguntas-js',
                    cacheValido: true,
                    dados: banco,
                    midiasSolicitadas: resultadoCache.midiasSolicitadas,
                    houveMudanca: resultadoCache.houveMudanca
                };
            }

            const modelo = banco.modelo || 'firestore';
            const resultadoCache = await salvarBancoNoCache(banco, modelo);

            return {
                sucesso: true,
                origem: 'firestore',
                cacheValido: true,
                dados: banco,
                midiasSolicitadas: resultadoCache.midiasSolicitadas,
                houveMudanca: resultadoCache.houveMudanca
            };
        } catch (erro) {
            console.error('❌ Erro ao sincronizar provas:', erro);

            return {
                sucesso: this.existeCacheValido(),
                origem: 'erro-com-fallback-cache',
                cacheValido: this.existeCacheValido(),
                erro
            };
        }
    },

    obterProvasCache() {
        return lerJSON(CACHE_PROVAS_KEY);
    },

    obterMetaCache() {
        return lerJSON(CACHE_META_KEY);
    },

    existeCacheValido() {
        const dados = this.obterProvasCache();
        const meta = this.obterMetaCache();

        if (!dados || bancoEstaVazio(dados) || !meta?.validoAte) {
            return false;
        }

        return Date.now() <= new Date(meta.validoAte).getTime();
    },

    limparCacheProvas() {
        localStorage.removeItem(CACHE_PROVAS_KEY);
        localStorage.removeItem(CACHE_META_KEY);
        localStorage.removeItem('chiteroicao_cache_offline_confirmado');

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'LIMPAR_CACHE_DINAMICO'
            });
        }
    }
};
