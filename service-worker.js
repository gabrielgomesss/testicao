const APP_VERSION = '2026.07.02.004';
const APP_CACHE_NAME = `chiteroicao-app-${APP_VERSION}`;
const MEDIA_CACHE_NAME = 'chiteroicao-media-atual';
const LEGACY_CACHE_PREFIXES = [
  'chiteroicao-static-',
  'chiteroicao-dynamic-',
  'chiteroicao-app-'
];
const OFFLINE_FALLBACK = './index.html';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './pwa-installer.js',
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './js/sync.js',

  './js/modules/admin.js',
  './js/modules/auth.js',
  './js/modules/simulador.js',
  './js/modules/sync-service.js',

  './js/views/view-admin.js',
  './js/views/view-aluno.js',
  './js/views/view-cadastro.js',
  './js/views/view-login.js',
  './js/views/view-simulado.js',

  './assets/imagens/Logotipo.avif',
  './assets/imagens/Logotipo.jpg',
  './assets/imagens/icon-192.png',
  './assets/imagens/icon-512.png',
  './assets/imagens/maskable-icon-512.png'
];

function normalizarUrlParaCache(url) {
  if (!url || typeof url !== 'string') return null;

  const texto = url.trim();
  if (!texto) return null;

  if (/^https?:\/\//i.test(texto)) return texto;
  if (texto.startsWith('./')) return texto;
  if (texto.startsWith('/')) return `.${texto}`;
  return `./${texto}`;
}

function isFirebaseStorageUrl(url) {
  try {
    const u = new URL(url, self.location.href);
    return u.hostname.includes('firebasestorage.googleapis.com') || u.hostname.includes('storage.googleapis.com');
  } catch {
    return false;
  }
}

function chaveLogicaMidia(url) {
  try {
    const u = new URL(url, self.location.href);

    if (isFirebaseStorageUrl(u.href)) {
      return `${u.origin}${u.pathname}`;
    }

    return `${u.origin}${u.pathname}`;
  } catch {
    return String(url || '').split('?')[0];
  }
}

function mesmaMidiaFirebase(urlA, urlB) {
  try {
    const a = new URL(urlA, self.location.href);
    const b = new URL(urlB, self.location.href);

    if (a.origin !== b.origin) return false;
    return a.pathname === b.pathname;
  } catch {
    return false;
  }
}

async function notificarClientes(payload) {
  try {
    const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clientsList.forEach((client) => {
      try { client.postMessage(payload); } catch { /* ignora */ }
    });
  } catch (erro) {
    console.warn('⚠️ SW: não foi possível notificar progresso.', erro);
  }
}

async function estimarUsoStorage() {
  try {
    if (navigator?.storage?.estimate) {
      return await navigator.storage.estimate();
    }
  } catch {
    // ignore
  }

  return { usage: 0, quota: 0 };
}

async function limparCachesLegados({ manterMidia = true } = {}) {
  const keys = await caches.keys();

  await Promise.all(keys.map((key) => {
    const isAppAtual = key === APP_CACHE_NAME;
    const isMediaAtual = key === MEDIA_CACHE_NAME;
    const isLegado = LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));

    if (isAppAtual) return Promise.resolve();
    if (manterMidia && isMediaAtual) return Promise.resolve();

    if (isLegado || key.startsWith('chiteroicao-media-') || key === 'chiteroicao-media-atual') {
      console.log(`🧹 SW: removendo cache antigo: ${key}`);
      return caches.delete(key);
    }

    return Promise.resolve();
  }));
}

async function limparAppCacheAntigoAntesDoInstall() {
  const keys = await caches.keys();

  await Promise.all(keys.map((key) => {
    const deveApagar = key !== APP_CACHE_NAME && LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
    return deveApagar ? caches.delete(key) : Promise.resolve();
  }));
}

async function jaExisteNoCache(cache, url) {
  try {
    const direto = await cache.match(url, { ignoreSearch: false, ignoreVary: true });
    if (direto) return true;

    const semQuery = await cache.match(url, { ignoreSearch: true, ignoreVary: true });
    if (semQuery) return true;

    const requestKeys = await cache.keys();
    const alvo = new URL(url, self.location.href);
    const chaveAlvo = chaveLogicaMidia(alvo.href);

    return requestKeys.some((request) => {
      const chaveReq = chaveLogicaMidia(request.url);
      return chaveReq === chaveAlvo || (isFirebaseStorageUrl(alvo.href) && mesmaMidiaFirebase(alvo.href, request.url));
    });
  } catch {
    return false;
  }
}

async function removerEntradasForaDaLista(cacheName, urlsPermitidas = []) {
  const cache = await caches.open(cacheName);
  const permitidas = new Set(urlsPermitidas.map(normalizarUrlParaCache).filter(Boolean).map(chaveLogicaMidia));

  if (!permitidas.size) return 0;

  const requests = await cache.keys();
  let removidas = 0;

  for (const request of requests) {
    const chave = chaveLogicaMidia(request.url);

    if (!permitidas.has(chave)) {
      await cache.delete(request);
      removidas += 1;
    }
  }

  if (removidas) {
    console.log(`🧹 SW: ${removidas} mídia(s) antigas removidas do cache offline.`);
  }

  return removidas;
}

async function cachearAppShell() {
  await limparAppCacheAntigoAntesDoInstall();

  const cache = await caches.open(APP_CACHE_NAME);
  const lista = Array.from(new Set(ASSETS_TO_CACHE.map(normalizarUrlParaCache).filter(Boolean)));

  for (const url of lista) {
    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (response && response.status === 200) {
        await cache.put(url, response.clone());
        console.log(`✅ SW: app shell cacheado: ${url}`);
      }
    } catch (erro) {
      console.warn(`⚠️ SW: não foi possível cachear app shell: ${url}`, erro);
    }
  }
}

async function buscarMidiaParaCache(url) {
  const firebaseStorage = isFirebaseStorageUrl(url);

  // Primeiro tenta CORS normal. Quando CORS está configurado no bucket, isso evita respostas opaque,
  // que consomem muito mais quota em alguns navegadores.
  try {
    const response = await fetch(new Request(url, {
      method: 'GET',
      credentials: firebaseStorage ? 'omit' : 'same-origin',
      cache: 'reload',
      mode: firebaseStorage ? 'cors' : 'same-origin'
    }));

    if (response && response.status === 200) return response;
  } catch (erroCors) {
    if (!firebaseStorage) throw erroCors;
  }

  // Fallback para Firebase Storage quando o domínio ainda não está autorizado por CORS.
  if (firebaseStorage) {
    return await fetch(new Request(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'reload',
      mode: 'no-cors'
    }));
  }

  throw new Error('Falha ao buscar mídia.');
}

async function cachearLista(cacheName, urls) {
  const lista = Array.from(new Set((urls || []).map(normalizarUrlParaCache).filter(Boolean)));
  const total = lista.length;

  if (!total) {
    await notificarClientes({ type: 'CACHE_PROGRESS', cacheName, total: 0, processados: 0, cacheados: 0, falhas: 0, concluido: true });
    return { total: 0, cacheados: 0, falhas: 0 };
  }

  await limparCachesLegados({ manterMidia: true });

  if (cacheName === MEDIA_CACHE_NAME) {
    await removerEntradasForaDaLista(MEDIA_CACHE_NAME, lista);
  }

  const cache = await caches.open(cacheName);
  let processados = 0;
  let cacheados = 0;
  let falhas = 0;

  const emitirProgresso = async (urlAtual = '', status = 'andamento') => {
    await notificarClientes({
      type: 'CACHE_PROGRESS',
      cacheName,
      total,
      processados,
      cacheados,
      falhas,
      urlAtual,
      status,
      concluido: processados >= total
    });
  };

  await emitirProgresso('', 'iniciando');

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const cachearUm = async (url) => {
    let sucesso = false;
    let ultimoErro = null;

    try {
      if (await jaExisteNoCache(cache, url)) {
        cacheados += 1;
        sucesso = true;
        return;
      }

      for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
        try {
          if (tentativa > 1) {
            await emitirProgresso(url, `tentativa-${tentativa}`);
            await esperar(650 * tentativa);
          }

          const response = await buscarMidiaParaCache(url);
          const respostaOK = response && (response.status === 200 || response.type === 'opaque');

          if (!respostaOK) {
            throw new Error(`Resposta ${response?.status || response?.type || 'sem status'}`);
          }

          try {
            await cache.put(url, response.clone());
          } catch (erroPut) {
            if (erroPut?.name === 'QuotaExceededError') {
              console.warn(`🧹 SW: quota excedida. Limpando caches antigos e mídias fora da lista antes de tentar novamente: ${url}`);
              await limparCachesLegados({ manterMidia: true });
              await removerEntradasForaDaLista(MEDIA_CACHE_NAME, lista);
              await esperar(500);
              await cache.put(url, response.clone());
            } else {
              throw erroPut;
            }
          }

          cacheados += 1;
          sucesso = true;
          console.log(`✅ SW: Cacheado: ${url} (${response.type || response.status})`);
          break;
        } catch (erroTentativa) {
          ultimoErro = erroTentativa;
          console.warn(`⚠️ SW: tentativa ${tentativa}/3 falhou para: ${url}`, erroTentativa);
        }
      }
    } catch (erro) {
      ultimoErro = erro;
    } finally {
      processados += 1;

      if (!sucesso) {
        falhas += 1;
        console.warn(`⚠️ SW: Arquivo não cacheado após retentativas: ${url}`, ultimoErro);
      }

      await emitirProgresso(url, sucesso ? 'cacheado' : 'falha');
    }
  };

  // Sequencial por padrão para reduzir picos de memória/quota no mobile.
  // O download completo fica mais estável para bancos grandes.
  for (const url of lista) {
    await cachearUm(url);
  }

  await emitirProgresso('', 'concluido');

  const estimate = await estimarUsoStorage();
  if (estimate?.quota) {
    console.log(`📦 SW: uso storage ${(estimate.usage / 1024 / 1024).toFixed(1)}MB / ${(estimate.quota / 1024 / 1024).toFixed(1)}MB`);
  }

  return { total, cacheados, falhas };
}

function deveIgnorarRequest(request) {
  const url = new URL(request.url);

  if (!request.url.startsWith('http')) return true;
  if (request.method !== 'GET') return true;

  const host = url.hostname;
  const path = url.pathname;

  if (host.includes('identitytoolkit.googleapis.com')) return true;
  if (host.includes('securetoken.googleapis.com')) return true;
  if (host.includes('firestore.googleapis.com')) return true;
  if (host.includes('firebaseinstallations.googleapis.com')) return true;
  if (host.includes('www.googleapis.com') && !path.includes('/storage/')) return true;

  return false;
}

async function procurarEmTodosOsCaches(request) {
  const requestUrl = request.url;

  const direto = await caches.match(request, { ignoreVary: true, ignoreSearch: false });
  if (direto) return direto;

  const diretoUrl = await caches.match(requestUrl, { ignoreVary: true, ignoreSearch: false });
  if (diretoUrl) return diretoUrl;

  const semQuery = await caches.match(requestUrl, { ignoreVary: true, ignoreSearch: true });
  if (semQuery) return semQuery;

  const url = new URL(requestUrl);
  if (url.origin === self.location.origin) {
    const relativo = `.${url.pathname}`;
    const local = await caches.match(relativo, { ignoreVary: true, ignoreSearch: true });
    if (local) return local;
  }

  const nomes = await caches.keys();

  for (const nome of nomes) {
    const cache = await caches.open(nome);
    const requests = await cache.keys();

    for (const cachedRequest of requests) {
      if (cachedRequest.url === requestUrl) {
        const resposta = await cache.match(cachedRequest, { ignoreVary: true });
        if (resposta) return resposta;
      }

      const reqUrl = requestUrl;
      if (isFirebaseStorageUrl(reqUrl) && mesmaMidiaFirebase(reqUrl, cachedRequest.url)) {
        const resposta = await cache.match(cachedRequest, { ignoreVary: true });
        if (resposta) return resposta;
      }

      if (chaveLogicaMidia(reqUrl) === chaveLogicaMidia(cachedRequest.url)) {
        const resposta = await cache.match(cachedRequest, { ignoreVary: true });
        if (resposta) return resposta;
      }
    }
  }

  return null;
}

async function encontrarNoCache(request) {
  return await procurarEmTodosOsCaches(request);
}

function extrairRange(rangeHeader, tamanhoTotal) {
  if (!rangeHeader) return null;

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : tamanhoTotal - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= tamanhoTotal) return null;

  end = Math.min(end, tamanhoTotal - 1);
  return { start, end };
}

async function responderRangeDoCache(request) {
  const cachedResponse = await encontrarNoCache(request);

  if (!cachedResponse) {
    try {
      return await fetch(request);
    } catch {
      return new Response('Mídia indisponível offline.', { status: 503, statusText: 'Offline' });
    }
  }

  const rangeHeader = request.headers.get('range');

  if (!rangeHeader || cachedResponse.type === 'opaque') {
    return cachedResponse.clone();
  }

  try {
    const buffer = await cachedResponse.clone().arrayBuffer();
    const tamanhoTotal = buffer.byteLength;
    const range = extrairRange(rangeHeader, tamanhoTotal);

    if (!range) return cachedResponse.clone();

    const chunk = buffer.slice(range.start, range.end + 1);
    const headers = new Headers(cachedResponse.headers);

    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${tamanhoTotal}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(chunk.byteLength));

    if (!headers.get('Content-Type')) headers.set('Content-Type', 'audio/mpeg');

    return new Response(chunk, { status: 206, statusText: 'Partial Content', headers });
  } catch (erro) {
    console.warn('⚠️ SW: Falha ao responder Range pelo cache. Retornando resposta completa.', erro);
    return cachedResponse.clone();
  }
}

function isRecursoEstaticoLocal(request) {
  try {
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return false;
    if (request.method !== 'GET') return false;
    if (request.mode === 'navigate') return true;

    const path = url.pathname.toLowerCase();

    return path.endsWith('/')
      || path.endsWith('/index.html')
      || path.endsWith('.html')
      || path.endsWith('.js')
      || path.endsWith('.css')
      || path.endsWith('.json')
      || path.endsWith('.webmanifest');
  } catch {
    return false;
  }
}

async function responderComRedePrimeiro(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });

    if (networkResponse && networkResponse.status === 200) {
      try {
        const cache = await caches.open(APP_CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (erroCache) {
        console.warn('⚠️ SW: não foi possível atualizar app cache. Seguindo com rede.', erroCache);
      }
    }

    return networkResponse;
  } catch {
    const cachedResponse = await encontrarNoCache(request);
    if (cachedResponse) return cachedResponse.clone();

    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) return fallback;
    }

    return new Response('Recurso indisponível offline.', { status: 503, statusText: 'Offline' });
  }
}

async function responderComCachePrimeiro(request) {
  if (request.headers.has('range')) return responderRangeDoCache(request);

  const cachedResponse = await encontrarNoCache(request);
  if (cachedResponse) return cachedResponse.clone();

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
      const url = new URL(request.url);
      const isSameOrigin = url.origin === self.location.origin;
      const isStorage = isFirebaseStorageUrl(request.url);

      if (isSameOrigin || isStorage) {
        try {
          const cache = await caches.open(isStorage ? MEDIA_CACHE_NAME : APP_CACHE_NAME);
          await cache.put(request, networkResponse.clone());
        } catch (erroCache) {
          console.warn('⚠️ SW: não foi possível salvar recurso dinâmico no cache.', erroCache);
        }
      }
    }

    return networkResponse;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) return fallback;
    }

    const cachedResponseFallback = await encontrarNoCache(request);
    if (cachedResponseFallback) return cachedResponseFallback.clone();

    return new Response('Recurso indisponível offline.', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(cachearAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    limparCachesLegados({ manterMidia: true })
      .then(() => self.clients.claim())
      .then(() => console.log(`✅ SW ativo na versão ${APP_VERSION}`))
  );
});

self.addEventListener('fetch', (event) => {
  if (deveIgnorarRequest(event.request)) return;

  if (isRecursoEstaticoLocal(event.request)) {
    event.respondWith(responderComRedePrimeiro(event.request));
    return;
  }

  event.respondWith(responderComCachePrimeiro(event.request));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'CACHEAR_PROVAS_DINAMICAS') {
    const urls = Array.isArray(data.urls) ? urlsUnicas(data.urls) : [];
    event.waitUntil(cachearLista(MEDIA_CACHE_NAME, urls));
    return;
  }

  if (data.type === 'LIMPAR_CACHE_DINAMICO') {
    event.waitUntil(caches.delete(MEDIA_CACHE_NAME));
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function urlsUnicas(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}
