const APP_VERSION = '2026.07.10.002';
const STATIC_CACHE_NAME = `chiteroicao-static-${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = 'chiteroicao-dynamic-v5';
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

const CODIGO_LOCAL_REGEX = /(?:\/|^)(?:index\.html|manifest\.json|pwa-installer\.js|css\/.*\.css|js\/.*\.js)(?:\?|$)/i;

function isRecursoCodigoLocal(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && CODIGO_LOCAL_REGEX.test(url.pathname);
  } catch {
    return false;
  }
}

function adicionarCacheBuster(url) {
  try {
    const u = new URL(url);
    u.searchParams.set('swv', APP_VERSION);
    return u.toString();
  } catch {
    return url;
  }
}

async function notificarClientesAtualizacao() {
  const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  await Promise.all(clientes.map(async (cliente) => {
    try {
      cliente.postMessage({ type: 'APP_UPDATED', version: APP_VERSION });
    } catch (erro) {
      console.warn('SW: não foi possível notificar cliente aberto.', erro);
    }
  }));
}

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

async function cachearLista(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const lista = Array.from(new Set((urls || []).map(normalizarUrlParaCache).filter(Boolean)));

  for (const url of lista) {
    try {
      const firebaseStorage = isFirebaseStorageUrl(url);

      const request = new Request(url, {
        method: 'GET',
        credentials: firebaseStorage ? 'omit' : 'same-origin',
        cache: 'reload',
        // Firebase Storage em produção pode bloquear CORS.
        // Para cache offline de mídias, usamos no-cors e aceitamos resposta opaque.
        mode: firebaseStorage ? 'cors' : 'same-origin'
      });

      const response = await fetch(request);
      const respostaOK = response && (response.status === 200 || response.type === 'opaque');

      if (respostaOK) {
        // Salva somente uma entrada por URL para evitar duplicidade de respostas opaque.
        // Em Firebase Storage com no-cors, a resposta vem como opaque:
        // não pode ser lida pelo JS, mas pode ser armazenada e servida offline pelo SW.
        await cache.put(url, response.clone());

        console.log(`✅ SW: Cacheado: ${url} (${response.type || response.status})`);
      } else {
        console.warn(`⚠️ SW: Resposta não cacheada (${response?.status || response?.type}): ${url}`);
      }
    } catch (e) {
      console.warn(`⚠️ SW: Arquivo pulado: ${url}`, e);
    }
  }
}

async function limparCachesAntigos() {
  const keys = await caches.keys();

  await Promise.all(
    keys.map((key) => {
      const ehStaticAntigo = key.startsWith('chiteroicao-static-') && key !== STATIC_CACHE_NAME;
      const ehShellAntigo = /app-shell|precache|workbox/i.test(key);

      // O cache dinâmico contém as provas, áudios e imagens offline e deve
      // permanecer preservado durante atualizações de código.
      if (ehStaticAntigo || ehShellAntigo) {
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

  if (!rangeHeader || cachedResponse.type === 'opaque') {
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

async function responderCodigoNetworkFirst(request) {
  try {
    const networkResponse = await fetch(new Request(request, { cache: 'no-store' }));

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (erro) {
    const cached = await encontrarNoCache(request);
    if (cached) return cached.clone();

    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_FALLBACK, { ignoreSearch: true });
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
    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isFirebaseStorage = url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('storage.googleapis.com');

    const fetchRequest = isFirebaseStorage
      ? new Request(request.url, {
          method: 'GET',
          credentials: 'omit',
          cache: 'reload',
          mode: 'cors'
        })
      : request;

    const networkResponse = await fetch(fetchRequest);
    const respostaOK = networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque');

    if (respostaOK && (isSameOrigin || isFirebaseStorage)) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put(request.url, networkResponse.clone());
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
  event.waitUntil(
    cachearLista(STATIC_CACHE_NAME, ASSETS_TO_CACHE)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await limparCachesAntigos();
    await self.clients.claim();
    await notificarClientesAtualizacao();
  })());
});

self.addEventListener('fetch', (event) => {
  if (deveIgnorarRequest(event.request)) return;

  // HTML, JS, CSS e manifest usam network-first. Assim, quando houver uma
  // versão nova em produção, o navegador recebe o código atual sem exigir
  // limpeza manual de cache. Offline, o cache estático continua funcionando.
  if (event.request.mode === 'navigate' || isRecursoCodigoLocal(event.request)) {
    event.respondWith(responderCodigoNetworkFirst(event.request));
    return;
  }

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
    event.waitUntil(caches.delete(DYNAMIC_CACHE_NAME));
    return;
  }

  if (data.type === 'GET_APP_VERSION') {
    event.source?.postMessage?.({ type: 'APP_VERSION', version: APP_VERSION });
    return;
  }

  if (data.type === 'FORCE_APP_UPDATE') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function urlsUnicas(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}
