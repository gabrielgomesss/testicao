import { AulasService } from '../modules/aulas-service.js';
import { VideoEncoder } from '../modules/video-encoder.js';

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
  if (!valor) return 'Tamanho não informado';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let atual = valor;
  let indice = 0;
  while (atual >= 1024 && indice < unidades.length - 1) {
    atual /= 1024;
    indice++;
  }
  return `${atual.toFixed(indice >= 2 ? 2 : 0)} ${unidades[indice]}`;
}

function formatarDuracao(segundos = 0) {
  const total = Math.max(0, Math.round(Number(segundos || 0)));
  if (!total) return 'Duração não informada';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${m}min` : `${m}min ${s}s`;
}

function obterDuracaoArquivo(arquivo) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(arquivo);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duracao = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      URL.revokeObjectURL(url);
      resolve(duracao);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

export const ViewAdminAulas = {
  aulas: [],
  aulaEmEdicao: null,
  arquivoSelecionado: null,
  arquivoPreparado: null,
  processamentoEmAndamento: false,
  beforeUnloadHandler: null,
  percentualProcessoAtual: 0,

  mount() {
    const tabs = document.querySelector('.admin-shell > div[style*="display: flex"]');
    const shell = document.querySelector('.admin-shell');
    if (!tabs || !shell || document.getElementById('tab-aulas')) return;

    const botao = document.createElement('button');
    botao.id = 'tab-aulas';
    botao.className = 'admin-tab';
    botao.dataset.tab = 'aulas';
    botao.textContent = 'Aulas';
    botao.style.cssText = 'background:#0f172a;color:#94a3b8;border:1px solid #1e293b;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer;';
    tabs.appendChild(botao);

    shell.insertAdjacentHTML('beforeend', `
      <section id="secao-aulas" class="admin-aulas-section" style="display:none;max-width:1080px;margin:0 auto;">
        <div class="admin-aulas-header">
          <div>
            <h2>Aulas em vídeo</h2>
            <p>Cadastre, otimize e publique as aulas que ficarão disponíveis online e offline.</p>
          </div>
          <button id="btn-nova-aula" class="aulas-btn aulas-btn-primary">+ Nova aula</button>
        </div>
        <div id="admin-aulas-feedback" class="aulas-feedback" style="display:none;"></div>
        <div id="admin-aulas-grid" class="admin-aulas-grid"></div>
      </section>
      <div id="modal-admin-aula" class="aulas-modal" style="display:none;">
        <div class="aulas-modal-card admin-aula-modal-card">
          <div class="aulas-modal-header">
            <div>
              <h2 id="modal-admin-aula-titulo">Nova aula</h2>
              <p>O vídeo pode ser enviado diretamente ou otimizado localmente antes do upload.</p>
            </div>
            <button id="btn-fechar-admin-aula" class="aulas-icon-btn" type="button">✕</button>
          </div>

          <form id="form-admin-aula" class="admin-aula-form">
            <div class="admin-aula-fields-grid">
              <label>
                <span>Título</span>
                <input id="aula-titulo" required maxlength="120" placeholder="Ex.: Introdução ao exame SDEA">
              </label>
              <label>
                <span>Módulo</span>
                <input id="aula-modulo" value="Módulo 1" maxlength="80">
              </label>
              <label>
                <span>Ordem</span>
                <input id="aula-ordem" type="number" min="0" value="1">
              </label>
              <label class="admin-aula-checkbox-label">
                <input id="aula-publicada" type="checkbox" checked>
                <span>Publicada para os alunos</span>
              </label>
            </div>

            <label>
              <span>Descrição</span>
              <textarea id="aula-descricao" rows="4" maxlength="1000" placeholder="Breve descrição da aula."></textarea>
            </label>

            <div class="admin-video-box">
              <label>
                <span>Arquivo de vídeo</span>
                <input id="aula-video-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/*">
              </label>
              <div id="aula-video-info" class="admin-video-info">Nenhum vídeo novo selecionado.</div>

              <div class="admin-encoder-check" style="display:grid;gap:10px;">
                <div style="padding:12px;border-radius:12px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:12px;line-height:1.5;">
                  O vídeo será automaticamente otimizado e preparado para streaming antes do envio. O processamento ocorre neste computador e não gera custo de conversão na nuvem.
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <label>
                    <span>Qualidade da aula</span>
                    <select id="aula-perfil-video" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;">
                      <option value="economico" selected>Econômica 480p — recomendada para uso offline</option>
                      <option value="padrao">Padrão 720p — melhor nitidez, arquivo maior</option>
                    </select>
                  </label>
                  <label>
                    <span>Velocidade do encoder</span>
                    <select id="aula-velocidade-video" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;">
                      <option value="rapido">Rápido — termina antes, arquivo um pouco maior</option>
                      <option value="equilibrado" selected>Equilibrado — recomendado</option>
                      <option value="compacto">Compacto — arquivo menor, demora mais</option>
                    </select>
                  </label>
                </div>
                <div id="aula-encoder-capacidade" style="font-size:11px;color:#64748b;line-height:1.45;"></div>
              </div>

              <div id="aula-processo-wrap" class="admin-processo-wrap" style="display:none;">
                <div class="admin-processo-label-row">
                  <span id="aula-processo-texto">Preparando...</span>
                  <span id="aula-processo-percentual">0%</span>
                </div>
                <div class="admin-processo-bar"><div id="aula-processo-barra"></div></div>
                <div id="aula-processo-log" class="admin-processo-log"></div>
                <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px;line-height:1.45;">
                  Não feche, recarregue ou saia desta página enquanto o vídeo estiver sendo preparado.
                </div>
              </div>
            </div>

            <div class="aulas-modal-actions">
              <button id="btn-cancelar-admin-aula" type="button" class="aulas-btn aulas-btn-secondary">Cancelar</button>
              <button id="btn-salvar-admin-aula" type="submit" class="aulas-btn aulas-btn-primary">Salvar aula</button>
            </div>
          </form>
        </div>
      </div>
    `);

    botao.addEventListener('click', () => this.abrirAba());
    document.getElementById('btn-nova-aula')?.addEventListener('click', () => this.abrirModal());
    document.getElementById('btn-fechar-admin-aula')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('btn-cancelar-admin-aula')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('aula-video-file')?.addEventListener('change', (event) => this.selecionarArquivo(event.target.files?.[0] || null));
    document.getElementById('form-admin-aula')?.addEventListener('submit', (event) => this.salvar(event));

    const capacidade = VideoEncoder.obterCapacidades();
    const capacidadeEl = document.getElementById('aula-encoder-capacidade');
    if (capacidadeEl) {
      capacidadeEl.textContent = capacidade.multithread
        ? `Encoder multithread ativo: até ${capacidade.threads} núcleos disponíveis.`
        : 'Encoder em modo compatível (1 núcleo). Em produção, publique os cabeçalhos COOP/COEP para ativar multithread.';
    }

    // Reaproveita as abas já existentes, mas garante que a seção de aulas seja ocultada.
    document.querySelectorAll('.admin-tab:not(#tab-aulas)').forEach((tab) => {
      tab.addEventListener('click', () => {
        const secao = document.getElementById('secao-aulas');
        if (secao) secao.style.display = 'none';
      });
    });
  },

  abrirAba() {
    document.getElementById('secao-alunos').style.display = 'none';
    document.getElementById('secao-provas').style.display = 'none';
    document.getElementById('secao-aulas').style.display = 'block';

    document.querySelectorAll('.admin-tab').forEach((btn) => {
      const ativa = btn.id === 'tab-aulas';
      btn.style.background = ativa ? '#06b6d4' : '#0f172a';
      btn.style.color = ativa ? '#fff' : '#94a3b8';
      btn.style.border = ativa ? 'none' : '1px solid #1e293b';
    });

    this.carregar();
  },

  feedback(texto, tipo = 'info') {
    const el = document.getElementById('admin-aulas-feedback');
    if (!el) return;
    el.style.display = texto ? 'block' : 'none';
    el.className = `aulas-feedback aulas-feedback-${tipo}`;
    el.textContent = texto;
  },

  async carregar() {
    const grid = document.getElementById('admin-aulas-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="aulas-loading">Carregando aulas...</div>';

    try {
      this.aulas = await AulasService.listarAulas();
      this.renderizar();
    } catch (erro) {
      console.error(erro);
      grid.innerHTML = `<div class="aulas-empty">Erro ao carregar aulas: ${escapar(erro.message)}</div>`;
    }
  },

  renderizar() {
    const grid = document.getElementById('admin-aulas-grid');
    if (!grid) return;

    if (!this.aulas.length) {
      grid.innerHTML = '<div class="aulas-empty">Nenhuma aula cadastrada. Clique em “Nova aula” para começar.</div>';
      return;
    }

    grid.innerHTML = this.aulas.map((aula) => `
      <article class="admin-aula-card">
        <div class="admin-aula-card-top">
          <div>
            <div class="admin-aula-status-row">
              <span class="aulas-pill">${escapar(aula.modulo || 'Módulo')}</span>
              <span class="aulas-pill ${aula.publicada === false ? 'aulas-pill-muted' : 'aulas-pill-success'}">${aula.publicada === false ? 'Rascunho' : 'Publicada'}</span>
            </div>
            <h3>${escapar(aula.titulo || 'Aula sem título')}</h3>
            <p>${escapar(aula.descricao || 'Sem descrição.')}</p>
          </div>
          <div class="admin-aula-order">#${Number(aula.ordem || 0)}</div>
        </div>
        <div class="admin-aula-meta">
          <span>${formatarDuracao(aula.duracaoSegundos)}</span>
          <span>${formatarBytes(aula.tamanhoBytes)}</span>
        </div>
        <div class="admin-aula-actions">
          <button class="aulas-btn aulas-btn-secondary btn-editar-aula" data-id="${escapar(aula.id)}">Editar</button>
          <button class="aulas-btn aulas-btn-danger btn-excluir-aula" data-id="${escapar(aula.id)}">Excluir</button>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.btn-editar-aula').forEach((btn) => {
      btn.addEventListener('click', () => this.abrirModal(this.aulas.find((aula) => aula.id === btn.dataset.id)));
    });
    grid.querySelectorAll('.btn-excluir-aula').forEach((btn) => {
      btn.addEventListener('click', () => this.excluir(this.aulas.find((aula) => aula.id === btn.dataset.id)));
    });
  },

  abrirModal(aula = null) {
    this.aulaEmEdicao = aula || null;
    this.arquivoSelecionado = null;
    this.arquivoPreparado = null;

    document.getElementById('modal-admin-aula-titulo').textContent = aula ? 'Editar aula' : 'Nova aula';
    document.getElementById('aula-titulo').value = aula?.titulo || '';
    document.getElementById('aula-modulo').value = aula?.modulo || 'Módulo 1';
    document.getElementById('aula-ordem').value = Number(aula?.ordem ?? (this.aulas.length + 1));
    document.getElementById('aula-publicada').checked = aula?.publicada !== false;
    document.getElementById('aula-descricao').value = aula?.descricao || '';
    document.getElementById('aula-video-file').value = '';
    document.getElementById('aula-video-info').textContent = aula?.videoUrl
      ? `Vídeo atual: ${formatarBytes(aula.tamanhoBytes)}. Selecione outro somente para substituir.`
      : 'Nenhum vídeo novo selecionado.';
    document.getElementById('aula-processo-wrap').style.display = 'none';
    document.getElementById('modal-admin-aula').style.display = 'flex';
  },

  fecharModal() {
    if (this.processamentoEmAndamento) {
      alert('O vídeo ainda está sendo preparado. Aguarde a conclusão do processamento.');
      return;
    }
    document.getElementById('modal-admin-aula').style.display = 'none';
    this.aulaEmEdicao = null;
    this.arquivoSelecionado = null;
    this.arquivoPreparado = null;
  },

  async selecionarArquivo(arquivo) {
    this.arquivoSelecionado = arquivo;
    this.arquivoPreparado = null;
    const info = document.getElementById('aula-video-info');
    if (!arquivo) {
      info.textContent = 'Nenhum vídeo novo selecionado.';
      return;
    }
    const duracao = await obterDuracaoArquivo(arquivo);
    info.textContent = `${arquivo.name} • ${formatarBytes(arquivo.size)} • ${formatarDuracao(duracao)}`;
  },

  atualizarProcesso(texto, percentual = undefined, log = '') {
    const wrap = document.getElementById('aula-processo-wrap');
    const textoEl = document.getElementById('aula-processo-texto');
    const percentualEl = document.getElementById('aula-processo-percentual');
    const barra = document.getElementById('aula-processo-barra');
    const logEl = document.getElementById('aula-processo-log');

    if (wrap) wrap.style.display = 'block';
    if (textoEl && texto) textoEl.textContent = texto;

    if (percentual !== undefined && percentual !== null) {
      const valor = Math.max(0, Math.min(100, Math.round(Number(percentual) || 0)));
      this.percentualProcessoAtual = valor;
      if (percentualEl) percentualEl.textContent = `${valor}%`;
      if (barra) barra.style.width = `${valor}%`;
    }

    if (logEl && log) logEl.textContent = log;
  },

  ativarProtecaoSaida() {
    this.processamentoEmAndamento = true;
    this.beforeUnloadHandler = (event) => {
      if (!this.processamentoEmAndamento) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  },

  desativarProtecaoSaida() {
    this.processamentoEmAndamento = false;
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  },

  async salvar(event) {
    event.preventDefault();
    if (this.processamentoEmAndamento) return;

    this.ativarProtecaoSaida();
    this.percentualProcessoAtual = 0;

    const botao = document.getElementById('btn-salvar-admin-aula');
    const btnCancelar = document.getElementById('btn-cancelar-admin-aula');
    const btnFechar = document.getElementById('btn-fechar-admin-aula');
    const arquivoOriginal = this.arquivoSelecionado;

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Preparando...';
      }
      if (btnCancelar) btnCancelar.disabled = true;
      if (btnFechar) btnFechar.disabled = true;

      let arquivoUpload = arquivoOriginal;
      if (arquivoOriginal) {
        const perfil = document.getElementById('aula-perfil-video')?.value || 'economico';
        const velocidade = document.getElementById('aula-velocidade-video')?.value || 'equilibrado';
        this.atualizarProcesso('Carregando encoder integrado...', 0);

        const resultadoPreparacao = await VideoEncoder.prepararAutomaticamente(arquivoOriginal, {
          perfil,
          velocidade,
          onProgress: (valor) => this.atualizarProcesso(`Otimizando vídeo — ${valor}%`, valor),
          onLog: (linha) => this.atualizarProcesso('Otimizando vídeo...', undefined, linha),
          onStage: (texto) => this.atualizarProcesso(texto, undefined)
        });

        arquivoUpload = resultadoPreparacao.arquivo;
        this.arquivoPreparado = arquivoUpload;
        this.atualizarProcesso(
          `${resultadoPreparacao.mensagem} ${formatarBytes(arquivoOriginal.size)} → ${formatarBytes(arquivoUpload.size)}`,
          100
        );
      }

      let videoUrl = this.aulaEmEdicao?.videoUrl || '';
      let videoPath = this.aulaEmEdicao?.videoPath || '';
      let tamanhoBytes = Number(this.aulaEmEdicao?.tamanhoBytes || 0);
      let duracaoSegundos = Number(this.aulaEmEdicao?.duracaoSegundos || 0);

      if (arquivoUpload) {
        duracaoSegundos = await obterDuracaoArquivo(arquivoUpload);
        if (botao) botao.textContent = 'Enviando vídeo...';
        this.atualizarProcesso('Enviando vídeo ao Firebase...', 0);
        const resultado = await AulasService.uploadVideo({
          arquivo: arquivoUpload,
          aulaId: this.aulaEmEdicao?.id || `nova-${Date.now()}`,
          onProgress: (valor) => this.atualizarProcesso(`Enviando vídeo — ${valor}%`, valor)
        });
        videoUrl = resultado.videoUrl;
        videoPath = resultado.videoPath;
        tamanhoBytes = resultado.tamanhoBytes;
      }

      const payload = {
        titulo: document.getElementById('aula-titulo').value,
        modulo: document.getElementById('aula-modulo').value,
        ordem: Number(document.getElementById('aula-ordem').value || 0),
        publicada: document.getElementById('aula-publicada').checked,
        descricao: document.getElementById('aula-descricao').value,
        videoUrl,
        videoPath,
        tamanhoBytes,
        duracaoSegundos
      };

      if (botao) botao.textContent = 'Salvando aula...';
      await AulasService.salvarAula(payload, this.aulaEmEdicao?.id || null);
      this.feedback('Aula salva com sucesso.', 'sucesso');
      this.desativarProtecaoSaida();
      this.fecharModal();
      await this.carregar();
    } catch (erro) {
      console.error(erro);
      this.feedback(erro.message || 'Não foi possível salvar a aula.', 'erro');
      alert(`Não foi possível salvar a aula: ${erro.message || erro}`);
    } finally {
      this.desativarProtecaoSaida();
      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Salvar aula';
      }
      if (btnCancelar) btnCancelar.disabled = false;
      if (btnFechar) btnFechar.disabled = false;
    }
  },

  async excluir(aula) {
    if (!aula?.id) return;
    if (!confirm(`Excluir definitivamente a aula “${aula.titulo}”?`)) return;

    try {
      await AulasService.excluirAula(aula);
      this.feedback('Aula excluída.', 'sucesso');
      await this.carregar();
    } catch (erro) {
      console.error(erro);
      this.feedback(`Erro ao excluir: ${erro.message}`, 'erro');
    }
  }
};
