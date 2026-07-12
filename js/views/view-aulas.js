import { AulasService } from '../modules/aulas-service.js';
import { AulasOffline } from '../modules/aulas-offline.js';

function escapar(valor = '') {
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatarBytes(bytes = 0) {
  const valor = Number(bytes || 0);
  if (!valor) return 'tamanho indisponível';

  const unidades = ['B', 'KB', 'MB', 'GB'];
  let atual = valor;
  let indice = 0;

  while (atual >= 1024 && indice < unidades.length - 1) {
    atual /= 1024;
    indice++;
  }

  return `${atual.toFixed(indice >= 2 ? 1 : 0)} ${unidades[indice]}`;
}

function formatarDuracao(segundos = 0) {
  const total = Math.round(Number(segundos || 0));
  if (!total) return 'Duração não informada';

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);

  return h ? `${h}h ${m}min` : `${m} min`;
}

export const ViewAulas = {
  playerObjectUrl: null,
  playerOperacaoId: null,

  template: `
    <div class="aulas-page">
      <header class="aulas-page-header">
        <button id="btn-voltar-aulas" class="aulas-back-btn" type="button">← Voltar</button>
        <div>
          <span class="aulas-eyebrow">TREINAMENTO</span>
          <h1>Aulas</h1>
          <p>Assista online ou escolha quais aulas deseja manter no dispositivo.</p>
        </div>
      </header>

      <main class="aulas-page-content">
        <div id="aulas-storage-info" class="aulas-storage-info">Verificando armazenamento...</div>
        <div id="aulas-aluno-feedback" class="aulas-feedback" style="display:none;"></div>
        <div id="aulas-lista" class="aulas-lista">
          <div class="aulas-loading">Carregando aulas...</div>
        </div>
      </main>

      <div id="aulas-player-modal" class="aulas-modal" style="display:none;">
        <div class="aulas-modal-card aulas-player-card">
          <div class="aulas-modal-header">
            <div>
              <span class="aulas-eyebrow">AULA EM VÍDEO</span>
              <h2 id="aulas-player-title">Aula</h2>
            </div>
            <button id="btn-fechar-player-aula" class="aulas-icon-btn" type="button">✕</button>
          </div>

          <video id="aulas-video-player" controls playsinline preload="metadata"></video>
        </div>
      </div>
    </div>
  `,

  aulas: [],
  statusOffline: new Map(),
  callbacks: {},
  listenerProgresso: null,

  async init(usuario, callbacks = {}) {
    this.callbacks = callbacks;

    document.getElementById('btn-voltar-aulas')
      ?.addEventListener('click', () => callbacks.onVoltar?.());

    document.getElementById('btn-fechar-player-aula')
      ?.addEventListener('click', () => this.fecharPlayer());

    document.getElementById('aulas-player-modal')
      ?.addEventListener('click', (event) => {
        if (event.target.id === 'aulas-player-modal') {
          this.fecharPlayer();
        }
      });

    this.listenerProgresso = (event) =>
      this.aplicarProgresso(event.detail || {});

    window.addEventListener(
      'chitero-aula-download-progress',
      this.listenerProgresso
    );

    await this.atualizarArmazenamento();
    await this.carregar();
  },

  destroy() {
    if (this.listenerProgresso) {
      window.removeEventListener(
        'chitero-aula-download-progress',
        this.listenerProgresso
      );
      this.listenerProgresso = null;
    }

    this.fecharPlayer();
  },

  feedback(texto, tipo = 'info') {
    const el = document.getElementById('aulas-aluno-feedback');
    if (!el) return;

    el.style.display = texto ? 'block' : 'none';
    el.className = `aulas-feedback aulas-feedback-${tipo}`;
    el.textContent = texto;
  },

  async atualizarArmazenamento() {
    const el = document.getElementById('aulas-storage-info');
    if (!el) return;

    const estimativa = await AulasOffline.estimarArmazenamento();

    if (!estimativa) {
      el.textContent = 'O navegador não informou o espaço disponível.';
      return;
    }

    const usado = formatarBytes(estimativa.usage || 0);
    const total = formatarBytes(estimativa.quota || 0);

    el.textContent =
      `Armazenamento do aplicativo: ${usado} utilizados de aproximadamente ${total}.`;
  },

  async carregar() {
    const lista = document.getElementById('aulas-lista');
    if (!lista) return;

    this.statusOffline.clear();

    // Offline: não tenta consultar o Firestore. O catálogo local contém os
    // metadados dos vídeos baixados e o Cache Storage contém os MP4.
    if (!navigator.onLine) {
      this.aulas = await AulasOffline.listarAulasSalvas();

      for (const aula of this.aulas) {
        this.statusOffline.set(aula.id, true);
      }

      if (this.aulas.length) {
        this.feedback(
          'Modo offline: exibindo somente as aulas salvas neste dispositivo.',
          'info'
        );
      }

      this.renderizar();
      return;
    }

    try {
      const aulasOnline = await AulasService.listarAulas({
        somentePublicadas: true
      });

      this.aulas = Array.isArray(aulasOnline) ? aulasOnline : [];

      // Mantém um catálogo local. Apenas vídeos realmente baixados serão
      // exibidos quando a conexão for desligada.
      AulasOffline.salvarCatalogo(this.aulas);

      await Promise.all(
        this.aulas.map(async (aula) => {
          this.statusOffline.set(
            aula.id,
            await AulasOffline.estaBaixada(aula)
          );
        })
      );

      this.renderizar();
    } catch (erro) {
      console.error('Falha ao carregar aulas online:', erro);

      // Se a rede caiu durante a consulta, recupera imediatamente o catálogo
      // das aulas já baixadas.
      this.aulas = await AulasOffline.listarAulasSalvas();

      for (const aula of this.aulas) {
        this.statusOffline.set(aula.id, true);
      }

      if (this.aulas.length) {
        this.feedback(
          'Não foi possível consultar o servidor. Exibindo as aulas salvas.',
          'info'
        );
        this.renderizar();
        return;
      }

      lista.innerHTML = `
        <div class="aulas-empty">
          Não foi possível carregar as aulas: ${escapar(erro?.message || erro)}
        </div>
      `;
    }
  },

  renderizar() {
    const lista = document.getElementById('aulas-lista');
    if (!lista) return;

    if (!this.aulas.length) {
      lista.innerHTML = navigator.onLine
        ? '<div class="aulas-empty">Nenhuma aula publicada no momento.</div>'
        : '<div class="aulas-empty">Nenhuma aula foi salva para uso offline neste dispositivo.</div>';
      return;
    }

    const modulos = new Map();

    this.aulas.forEach((aula) => {
      const modulo = aula.modulo || 'Módulo 1';
      if (!modulos.has(modulo)) modulos.set(modulo, []);
      modulos.get(modulo).push(aula);
    });

    lista.innerHTML = Array.from(modulos.entries())
      .map(([modulo, aulas]) => `
        <section class="aulas-modulo">
          <div class="aulas-modulo-header">
            <span class="aulas-eyebrow">MÓDULO</span>
            <h2>${escapar(modulo)}</h2>
          </div>

          <div class="aulas-modulo-grid">
            ${aulas.map((aula) => this.card(aula)).join('')}
          </div>
        </section>
      `)
      .join('');

    lista.querySelectorAll('.btn-assistir-aula').forEach((btn) => {
      btn.addEventListener('click', () => {
        const aula = this.aulas.find(
          (item) => String(item.id) === String(btn.dataset.id)
        );
        this.abrirPlayer(aula);
      });
    });

    lista.querySelectorAll('.aula-offline-toggle').forEach((input) => {
      input.addEventListener('change', () => this.alternarOffline(input));
    });
  },

  card(aula) {
    const baixada = this.statusOffline.get(aula.id) === true;

    return `
      <article class="aula-card" data-aula-id="${escapar(aula.id)}">
        <div class="aula-card-index">
          ${String(Number(aula.ordem || 0)).padStart(2, '0')}
        </div>

        <div class="aula-card-content">
          <h3>${escapar(aula.titulo || 'Aula')}</h3>
          <p>${escapar(aula.descricao || 'Sem descrição.')}</p>

          <div class="aula-card-meta">
            <span>${formatarDuracao(aula.duracaoSegundos)}</span>
            <span>${formatarBytes(aula.tamanhoBytes)}</span>
          </div>

          <div class="aula-download-progress" style="display:none;">
            <div class="aula-download-progress-row">
              <span>Baixando...</span>
              <strong>0%</strong>
            </div>
            <div class="aula-download-progress-track"><div></div></div>
          </div>

          <div class="aula-card-actions">
            <button
              class="aulas-btn aulas-btn-primary btn-assistir-aula"
              data-id="${escapar(aula.id)}"
            >
              Assistir aula
            </button>

            <label class="aula-offline-control">
              <span>
                <strong>Disponível offline</strong>
                <small>
                  ${baixada
                    ? 'Vídeo salvo neste dispositivo'
                    : 'Baixar somente esta aula'}
                </small>
              </span>

              <input
                class="aula-offline-toggle"
                type="checkbox"
                data-id="${escapar(aula.id)}"
                ${baixada ? 'checked' : ''}
              >
              <i aria-hidden="true"></i>
            </label>
          </div>
        </div>
      </article>
    `;
  },

  async alternarOffline(input) {
    const aula = this.aulas.find(
      (item) => String(item.id) === String(input.dataset.id)
    );

    if (!aula) return;

    input.disabled = true;

    try {
      if (input.checked) {
        const estimativa = await AulasOffline.estimarArmazenamento();

        if (estimativa && aula.tamanhoBytes) {
          const livre =
            Number(estimativa.quota || 0) -
            Number(estimativa.usage || 0);

          if (
            livre > 0 &&
            Number(aula.tamanhoBytes) > livre * 0.9
          ) {
            throw new Error(
              'Não há espaço suficiente para baixar esta aula.'
            );
          }
        }

        await AulasOffline.baixar(aula);
        this.statusOffline.set(aula.id, true);
        this.feedback('Aula disponível offline.', 'sucesso');
      } else {
        await AulasOffline.remover(aula);
        this.statusOffline.set(aula.id, false);
        this.feedback(
          'Aula removida do armazenamento offline.',
          'info'
        );
      }

      await this.atualizarArmazenamento();

      // Se estiver offline e a aula foi removida, ela deve desaparecer da lista.
      if (!navigator.onLine && !input.checked) {
        this.aulas = await AulasOffline.listarAulasSalvas();
      }

      this.renderizar();
    } catch (erro) {
      console.error(erro);
      input.checked = !input.checked;
      this.feedback(
        erro?.message || 'Falha ao alterar o modo offline.',
        'erro'
      );
    } finally {
      input.disabled = false;
    }
  },

  aplicarProgresso({
    aulaId,
    progresso = 0,
    bytesRecebidos = 0,
    totalBytes = 0
  }) {
    const seletor =
      `.aula-card[data-aula-id="${CSS.escape(String(aulaId || ''))}"]`;

    const card = document.querySelector(seletor);
    if (!card) return;

    const wrap = card.querySelector('.aula-download-progress');
    const strong = wrap?.querySelector('strong');
    const barra = wrap?.querySelector(
      '.aula-download-progress-track > div'
    );
    const texto = wrap?.querySelector('span');

    if (wrap) {
      wrap.style.display = progresso >= 100 ? 'none' : 'block';
    }

    if (strong) strong.textContent = `${progresso}%`;
    if (barra) barra.style.width = `${progresso}%`;

    if (texto && totalBytes) {
      texto.textContent =
        `${formatarBytes(bytesRecebidos)} de ${formatarBytes(totalBytes)}`;
    }
  },

  async abrirPlayer(aula) {
    if (!aula?.videoUrl) return;

    const modal = document.getElementById('aulas-player-modal');
    const player = document.getElementById('aulas-video-player');
    const titulo = document.getElementById('aulas-player-title');

    if (!modal || !player || !titulo) return;

    const operacaoId = `${Date.now()}-${Math.random()}`;
    this.playerOperacaoId = operacaoId;

    try {
      player.pause();
    } catch {
      // Ignora.
    }

    player.removeAttribute('src');
    player.removeAttribute('poster');

    if (this.playerObjectUrl) {
      URL.revokeObjectURL(this.playerObjectUrl);
      this.playerObjectUrl = null;
    }

    titulo.textContent = aula.titulo || 'Aula';
    modal.style.display = 'flex';

    player.controls = true;
    player.playsInline = true;
    player.preload = 'metadata';

    try {
      const baixada = this.statusOffline.get(aula.id) === true;
      let origemVideo = aula.videoUrl;

      if (baixada) {
        const blob = await AulasOffline.obterBlob(aula);

        if (this.playerOperacaoId !== operacaoId) return;

        if (!blob) {
          throw new Error(
            'O vídeo offline não foi encontrado. Conecte-se novamente e baixe a aula.'
          );
        }

        this.playerObjectUrl = URL.createObjectURL(blob);
        origemVideo = this.playerObjectUrl;
      } else if (!navigator.onLine) {
        throw new Error(
          'Esta aula não está disponível offline neste dispositivo.'
        );
      } else {
        const url = new URL(aula.videoUrl);
        url.searchParams.set('streamv', '4');
        origemVideo = url.toString();
      }

      if (this.playerOperacaoId !== operacaoId) return;

      player.src = origemVideo;
      player.load();
    } catch (erro) {
      console.error('Não foi possível preparar o vídeo:', erro);
      alert(
        `Não foi possível preparar esta aula: ${erro?.message || erro}`
      );
    }
  },

  fecharPlayer() {
    this.playerOperacaoId = null;

    const modal = document.getElementById('aulas-player-modal');
    const player = document.getElementById('aulas-video-player');

    if (player) {
      try {
        player.pause();
      } catch {
        // Ignora.
      }

      player.removeAttribute('src');
      player.load();
    }

    if (this.playerObjectUrl) {
      URL.revokeObjectURL(this.playerObjectUrl);
      this.playerObjectUrl = null;
    }

    if (modal) {
      modal.style.display = 'none';
    }
  }
};
