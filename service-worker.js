const APP_VERSION = '2026.07.02.003';
const STATIC_CACHE_NAME = `chiteroicao-static-${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = `chiteroicao-dynamic-${APP_VERSION}`;
const CLIENT_MEDIA_CACHE_PREFIX = 'chiteroicao-dynamic-midia';
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

  './assets/data/perguntas.js',

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
    const u = new URL(url);
    return u.hostname.includes('firebasestorage.googleapis.com') || u.hostname.includes('storage.googleapis.com');
  } catch {
    return false;
  }
}

function mesmaMidiaFirebase(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);

    if (a.origin !== b.origin) return false;

    // Firebase Storage usa o caminho /v0/b/<bucket>/o/<arquivo-encodado>
    // O token pode variar; o arquivo real está no pathname.
    return a.pathname === b.pathname;
  } catch {
    return false;
  }
}

async function notificarClientes(payload) {
  try {
    const clientsList = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window'
    });

    clientsList.forEach((client) => {
      try {
        client.postMessage(payload);
      } catch {
        // ignora cliente indisponível
      }
    });
  } catch (erro) {
    console.warn('⚠️ SW: não foi possível notificar progresso.', erro);
  }
}

async function jaExisteNoCache(cache, url) {
  try {
    const direto = await cache.match(url, { ignoreSearch: false, ignoreVary: true });
    if (direto) return true;

    const semQuery = await cache.match(url, { ignoreSearch: true, ignoreVary: true });
    if (semQuery) return true;

    const requestKeys = await cache.keys();
    const alvo = new URL(url, self.location.href);

    return requestKeys.some((request) => {
      try {
        const reqUrl = new URL(request.url);

        if (reqUrl.href === alvo.href) return true;
        if (reqUrl.origin === alvo.origin && reqUrl.pathname === alvo.pathname) return true;

        return isFirebaseStorageUrl(alvo.href) && mesmaMidiaFirebase(alvo.href, reqUrl.href);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function cachearLista(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const lista = Array.from(new Set((urls || []).map(normalizarUrlParaCache).filter(Boolean)));
  const total = lista.length;

  if (!total) {
    await notificarClientes({
      type: 'CACHE_PROGRESS',
      cacheName,
      total: 0,
      processados: 0,
      cacheados: 0,
      falhas: 0,
      concluido: true
    });
    return { total: 0, cacheados: 0, falhas: 0 };
  }

  let processados = 0;
  let cacheados = 0;
  let falhas = 0;
  const pendentesRetry = [];

  const emitirProgresso = async (urlAtual = '', status = 'andamento', concluido = false) => {
    await notificarClientes({
      type: 'CACHE_PROGRESS',
      cacheName,
      total,
      processados,
      cacheados,
      falhas,
      urlAtual,
      status,
      concluido
    });
  };

  await emitirProgresso('', 'iniciando', false);

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchComTimeout = async (url, timeoutMs = 70000) => {
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
  };

  const cachearUm = async (url, rodada = 1) => {
    if (await jaExisteNoCache(cache, url)) {
      cacheados += 1;
      await emitirProgresso(url, 'ja-cacheado', false);
      return true;
    }

    let ultimoErro = null;
    const maxTentativas = rodada === 1 ? 3 : 2;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      try {
        if (tentativa > 1) {
          await emitirProgresso(url, `tentativa-${tentativa}`, false);
          await esperar(900 * tentativa);
        }

        const response = await fetchComTimeout(url, rodada === 1 ? 70000 : 90000);

        if (response && (response.ok || response.status === 200 || response.type === 'opaque')) {
          await cache.put(url, response.clone());
          cacheados += 1;
          console.log(`✅ SW: Cacheado: ${url}`);
          await emitirProgresso(url, 'cacheado', false);
          return true;
        }

        ultimoErro = new Error(`Resposta ${response?.status || 'sem status'}`);
      } catch (erroTentativa) {
        ultimoErro = erroTentativa;
        console.warn(`⚠️ SW: tentativa ${tentativa}/${maxTentativas} falhou para: ${url}`, erroTentativa);
      }
    }

    console.warn(`⚠️ SW: Arquivo pendente após retentativas: ${url}`, ultimoErro);
    return false;
  };

  const processarLista = async (listaProcesso, rodada = 1, concorrencia = 2) => {
    let cursor = 0;

    const trabalhador = async () => {
      while (cursor < listaProcesso.length) {
        const indice = cursor;
        cursor += 1;
        const url = listaProcesso[indice];
        const ok = await cachearUm(url, rodada);

        processados += 1;

        if (!ok) {
          if (rodada === 1) {
            pendentesRetry.push(url);
          } else {
            falhas += 1;
          }
        }

        await emitirProgresso(url, ok ? 'cacheado' : 'falha-temporaria', false);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concorrencia, listaProcesso.length) }, () => trabalhador())
    );
  };

  // Produção/mobile: baixa com baixa concorrência para não saturar rede/memória.
  await processarLista(lista, 1, 2);

  if (pendentesRetry.length > 0) {
    const retryList = pendentesRetry.splice(0, pendentesRetry.length);
    processados = Math.max(0, total - retryList.length);
    falhas = 0;
    await emitirProgresso('', 'retentativa-final', false);
    await processarLista(retryList, 2, 1);
  }

  await emitirProgresso('', falhas > 0 ? 'concluido-com-falhas' : 'concluido', true);

  return { total, cacheados, falhas };
}

async function limparCachesAntigos() {
  const nomesPermitidos = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  const keys = await caches.keys();

  await Promise.all(
    keys.map((key) => {
      if (!nomesPermitidos.includes(key) && !key.startsWith(CLIENT_MEDIA_CACHE_PREFIX)) {
        return caches.delete(key);
      }

      return Promise.resolve();
    })
  );
}

function deveIgnorarRequest(request) {
  const url = new URL(request.url);

  if (!request.url.startsWith('http')) return true;
  if (request.method !== 'GET') return true;

  const host = url.hostname;
  const path = url.pathname;

  // Não intercepta autenticação, Firestore e APIs internas do Google.
  // Firebase Storage fica liberado para permitir cache offline de mídias.
  if (host.includes('identitytoolkit.googleapis.com')) return true;
  if (host.includes('securetoken.googleapis.com')) return true;
  if (host.includes('firestore.googleapis.com')) return true;
  if (host.includes('firebaseinstallations.googleapis.com')) return true;
  if (host.includes('www.googleapis.com') && !path.includes('/storage/')) return true;

  return false;
}

async function procurarEmTodosOsCaches(request) {
  const requestUrl = request.url;

  // 1. Match normal por Request.
  const direto = await caches.match(request, {
    ignoreVary: true,
    ignoreSearch: false
  });

  if (direto) return direto;

  // 2. Match por URL string.
  const diretoUrl = await caches.match(requestUrl, {
    ignoreVary: true,
    ignoreSearch: false
  });

  if (diretoUrl) return diretoUrl;

  // 3. Match ignorando querystring/token.
  const semQuery = await caches.match(requestUrl, {
    ignoreVary: true,
    ignoreSearch: true
  });

  if (semQuery) return semQuery;

  // 4. Para arquivos locais: tenta ./assets/...
  const url = new URL(requestUrl);
  if (url.origin === self.location.origin) {
    const relativo = `.${url.pathname}`;

    const local = await caches.match(relativo, {
      ignoreVary: true,
      ignoreSearch: true
    });

    if (local) return local;
  }

  // 5. Fallback forte: percorre as chaves de todos os caches.
  // Isso resolve o caso em que a mídia foi cacheada, mas a Request
  // gerada pelo navegador para <audio>/<img> não bate exatamente.
  const nomes = await caches.keys();

  for (const nome of nomes) {
    const cache = await caches.open(nome);
    const requests = await cache.keys();

    for (const cachedRequest of requests) {
      if (cachedRequest.url === requestUrl) {
        const resposta = await cache.match(cachedRequest, { ignoreVary: true });
        if (resposta) return resposta;
      }

      if (isFirebaseStorageUrl(requestUrl) && mesmaMidiaFirebase(requestUrl, cachedRequest.url)) {
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

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= tamanhoTotal) {
    return null;
  }

  end = Math.min(end, tamanhoTotal - 1);

  return { start, end };
}

async function responderRangeDoCache(request) {
  const cachedResponse = await encontrarNoCache(request);

  if (!cachedResponse) {
    try {
      return await fetch(request);
    } catch (erro) {
      return new Response('Mídia indisponível offline.', {
        status: 503,
        statusText: 'Offline'
      });
    }
  }

  const rangeHeader = request.headers.get('range');

  if (!rangeHeader) {
    return cachedResponse.clone();
  }

  try {
    const buffer = await cachedResponse.clone().arrayBuffer();
    const tamanhoTotal = buffer.byteLength;
    const range = extrairRange(rangeHeader, tamanhoTotal);

    if (!range) {
      return cachedResponse.clone();
    }

    const chunk = buffer.slice(range.start, range.end + 1);
    const headers = new Headers(cachedResponse.headers);

    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${tamanhoTotal}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(chunk.byteLength));

    if (!headers.get('Content-Type')) {
      headers.set('Content-Type', 'audio/mpeg');
    }

    return new Response(chunk, {
      status: 206,
      statusText: 'Partial Content',
      headers
    });
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
      const cache = await caches.open(STATIC_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      await cache.put(request.url, networkResponse.clone());
    }

    return networkResponse;
  } catch (erro) {
    const cachedResponse = await encontrarNoCache(request);
    if (cachedResponse) return cachedResponse.clone();

    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) return fallback;
    }

    return new Response('Recurso indisponível offline.', {
      status: 503,
      statusText: 'Offline'
    });
  }
}

async function responderComCachePrimeiro(request) {
  if (request.headers.has('range')) {
    return responderRangeDoCache(request);
  }

  const cachedResponse = await encontrarNoCache(request);
  if (cachedResponse) {
    return cachedResponse.clone();
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const url = new URL(request.url);
      const isSameOrigin = url.origin === self.location.origin;
      const isFirebaseStorage = url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('storage.googleapis.com');

      if (isSameOrigin || isFirebaseStorage) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.put(request, networkResponse.clone());
        await cache.put(request.url, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (erro) {
    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK);
      if (fallback) return fallback;
    }

    const cachedResponseFallback = await encontrarNoCache(request);
    if (cachedResponseFallback) {
      return cachedResponseFallback.clone();
    }

    return new Response('Recurso indisponível offline.', {
      status: 503,
      statusText: 'Offline'
    });
  }
}

self.addEventListener('install', (event) => {
  // Garante que uma nova versão publicada não fique presa em waiting.
  self.skipWaiting();

  event.waitUntil(
    cachearLista(STATIC_CACHE_NAME, ASSETS_TO_CACHE)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    limparCachesAntigos()
      .then(() => self.clients.claim())
      .then(() => console.log(`✅ SW ativo na versão ${APP_VERSION}`))
  );
});

self.addEventListener('fetch', (event) => {
  if (deveIgnorarRequest(event.request)) return;

  // Arquivos do próprio app usam rede primeiro.
  // Isso evita que view-admin.js, view-simulado.js, app.js, CSS e HTML fiquem presos
  // em versões antigas do cache quando você publica uma atualização.
  if (isRecursoEstaticoLocal(event.request)) {
    event.respondWith(responderComRedePrimeiro(event.request));
    return;
  }

  // Mídias e recursos dinâmicos continuam cache-first para preservar o offline.
  event.respondWith(responderComCachePrimeiro(event.request));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'CACHEAR_PROVAS_DINAMICAS') {
    const urls = Array.isArray(data.urls) ? urlsUnicas(data.urls) : [];
    event.waitUntil(cachearLista(DYNAMIC_CACHE_NAME, urls));
    return;
  }

  if (data.type === 'LIMPAR_CACHE_DINAMICO') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key === DYNAMIC_CACHE_NAME || key.startsWith(CLIENT_MEDIA_CACHE_PREFIX)).map((key) => caches.delete(key)));
    })());
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
});

function urlsUnicas(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}
