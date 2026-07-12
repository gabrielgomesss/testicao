const CACHE_NAME = 'chiteroicao-aulas-offline-v1';
const CATALOGO_KEY = 'chiteroicao_aulas_catalogo_offline_v2';

function lerCatalogo() {
  try {
    const bruto = localStorage.getItem(CATALOGO_KEY);
    const dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn('Catálogo offline de aulas inválido. Reiniciando.', erro);
    localStorage.removeItem(CATALOGO_KEY);
    return [];
  }
}

function salvarCatalogoLocal(aulas = []) {
  const mapa = new Map();

  lerCatalogo().forEach((aula) => {
    if (aula?.id) mapa.set(String(aula.id), aula);
  });

  aulas.forEach((aula) => {
    if (!aula?.id) return;

    mapa.set(String(aula.id), {
      id: String(aula.id),
      titulo: aula.titulo || 'Aula',
      descricao: aula.descricao || '',
      modulo: aula.modulo || 'Módulo 1',
      ordem: Number(aula.ordem || 0),
      publicada: aula.publicada !== false,
      ativa: aula.ativa !== false,
      videoUrl: aula.videoUrl || '',
      duracaoSegundos: Number(aula.duracaoSegundos || 0),
      tamanhoBytes: Number(aula.tamanhoBytes || 0),
      atualizadoEm: aula.updatedAt || aula.atualizadoEm || new Date().toISOString()
    });
  });

  const lista = Array.from(mapa.values());
  localStorage.setItem(CATALOGO_KEY, JSON.stringify(lista));
  return lista;
}

function removerDoCatalogo(aulaId) {
  const id = String(aulaId || '');
  const lista = lerCatalogo().filter((aula) => String(aula.id) !== id);
  localStorage.setItem(CATALOGO_KEY, JSON.stringify(lista));
}

function criarCanalMensagem(payload, timeoutMs = 120000) {
  return new Promise(async (resolve, reject) => {
    if (!('serviceWorker' in navigator)) {
      reject(new Error('Service Worker indisponível.'));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;

      if (!worker) {
        reject(new Error('Service Worker ainda não está ativo. Reabra o aplicativo.'));
        return;
      }

      const channel = new MessageChannel();
      const timer = setTimeout(
        () => reject(new Error('Tempo limite excedido.')),
        timeoutMs
      );

      channel.port1.onmessage = (event) => {
        const data = event.data || {};

        if (data.progresso !== undefined) {
          window.dispatchEvent(
            new CustomEvent('chitero-aula-download-progress', { detail: data })
          );
          return;
        }

        clearTimeout(timer);

        if (data.sucesso === false) {
          reject(new Error(data.erro || 'Falha na operação offline.'));
        } else {
          resolve(data);
        }
      };

      worker.postMessage(payload, [channel.port2]);
    } catch (erro) {
      reject(erro);
    }
  });
}

async function localizarResposta(aula) {
  if (!('caches' in window) || !aula?.videoUrl) return null;

  const cache = await caches.open(CACHE_NAME);

  let resposta = await cache.match(aula.videoUrl, {
    ignoreSearch: false,
    ignoreVary: true
  });

  if (resposta) return resposta;

  try {
    const alvo = new URL(aula.videoUrl);
    const requests = await cache.keys();

    const correspondente = requests.find((request) => {
      try {
        const atual = new URL(request.url);
        return atual.origin === alvo.origin && atual.pathname === alvo.pathname;
      } catch {
        return false;
      }
    });

    if (correspondente) {
      resposta = await cache.match(correspondente, { ignoreVary: true });
    }
  } catch {
    // URL inválida: retorna null.
  }

  return resposta || null;
}

export const AulasOffline = {
  CACHE_NAME,
  CATALOGO_KEY,

  salvarCatalogo(aulas = []) {
    return salvarCatalogoLocal(aulas);
  },

  obterCatalogo() {
    return lerCatalogo();
  },

  async listarAulasSalvas() {
    const catalogo = lerCatalogo();
    const resultado = [];

    for (const aula of catalogo) {
      if (await this.estaBaixada(aula)) {
        resultado.push(aula);
      }
    }

    return resultado.sort((a, b) => {
      const modulo = String(a.modulo || '').localeCompare(String(b.modulo || ''), 'pt-BR');
      if (modulo !== 0) return modulo;
      return Number(a.ordem || 0) - Number(b.ordem || 0);
    });
  },

  async baixar(aula) {
    if (!navigator.onLine) {
      throw new Error('Conecte-se à internet para baixar a aula.');
    }

    if (!aula?.videoUrl) {
      throw new Error('Esta aula não possui vídeo.');
    }

    const resultado = await criarCanalMensagem({
      type: 'DOWNLOAD_AULA_OFFLINE',
      aulaId: aula.id,
      url: aula.videoUrl
    }, 30 * 60 * 1000);

    // O vídeo e seus metadados precisam ser persistidos.
    // Sem este catálogo, o Firestore fica inacessível offline e a tela não
    // sabe qual card deve exibir, mesmo que o MP4 já esteja no Cache Storage.
    salvarCatalogoLocal([aula]);

    return resultado;
  },

  async remover(aula) {
    const resultado = await criarCanalMensagem({
      type: 'REMOVE_AULA_OFFLINE',
      aulaId: aula.id,
      url: aula.videoUrl
    });

    removerDoCatalogo(aula?.id);
    return resultado;
  },

  async estaBaixada(aula) {
    if (!aula?.videoUrl) return false;

    try {
      const resultado = await criarCanalMensagem({
        type: 'CHECK_AULA_OFFLINE',
        aulaId: aula.id,
        url: aula.videoUrl
      }, 15000);

      return Boolean(resultado.baixada);
    } catch {
      return Boolean(await localizarResposta(aula));
    }
  },

  async obterBlob(aula) {
    const resposta = await localizarResposta(aula);
    if (!resposta) return null;
    return resposta.blob();
  },

  async estimarArmazenamento() {
    if (!navigator.storage?.estimate) return null;
    return navigator.storage.estimate();
  }
};
