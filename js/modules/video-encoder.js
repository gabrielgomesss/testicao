const LIMITE_RECOMENDADO_BYTES = 600 * 1024 * 1024;
const MAX_THREADS = 8;

function isDesktop() {
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function nomeSeguro(nome = 'video.mp4') {
  const base = String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return base || 'video.mp4';
}

function quantidadeThreads() {
  const nucleos = Number(navigator.hardwareConcurrency || 4);
  return Math.max(2, Math.min(MAX_THREADS, nucleos > 2 ? nucleos - 1 : 2));
}

async function criarInstancia(onLog = () => {}, onStage = () => {}) {
  const [{ FFmpeg }, { fetchFile }] = await Promise.all([
    import('../../vendor/ffmpeg/ffmpeg/index.js'),
    import('../../vendor/ffmpeg/util/index.js')
  ]);

  const ffmpeg = new FFmpeg();
  const usarMultithread = self.crossOriginIsolated === true && Number(navigator.hardwareConcurrency || 1) > 1;
  const pastaCore = usarMultithread ? 'core-mt' : 'core';

  const coreURL = new URL(`../../vendor/ffmpeg/${pastaCore}/ffmpeg-core.js`, import.meta.url).href;
  const wasmURL = new URL(`../../vendor/ffmpeg/${pastaCore}/ffmpeg-core.wasm`, import.meta.url).href;
  const workerURL = usarMultithread
    ? new URL('../../vendor/ffmpeg/core-mt/ffmpeg-core.worker.js', import.meta.url).href
    : undefined;

  ffmpeg.on('log', ({ message }) => onLog(message || ''));
  onStage(usarMultithread
    ? `Iniciando encoder multithread (${quantidadeThreads()} núcleos)...`
    : 'Iniciando encoder compatível (1 núcleo)...');

  await ffmpeg.load({ coreURL, wasmURL, ...(workerURL ? { workerURL } : {}) });

  return { ffmpeg, fetchFile, usarMultithread };
}

async function executar(ffmpeg, args) {
  const codigo = await ffmpeg.exec(args);
  if (codigo !== 0) throw new Error(`O encoder terminou com código ${codigo}.`);
}

async function lerSaidaComoArquivo(ffmpeg, caminho, nome) {
  const dados = await ffmpeg.readFile(caminho);
  const buffer = dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength);
  return new File([buffer], nome, { type: 'video/mp4', lastModified: Date.now() });
}

function configPorPerfil(perfil, velocidade) {
  const padrao = perfil === 'padrao';
  const configsVelocidade = {
    rapido: {
      preset: 'ultrafast',
      fps: padrao ? 20 : 18,
      crf: padrao ? '30' : '32',
      maxrate: padrao ? '1000k' : '560k',
      bufsize: padrao ? '2000k' : '1120k'
    },
    equilibrado: {
      preset: 'veryfast',
      fps: 20,
      crf: padrao ? '28' : '30',
      maxrate: padrao ? '900k' : '500k',
      bufsize: padrao ? '1800k' : '1000k'
    },
    compacto: {
      preset: 'faster',
      fps: 24,
      crf: padrao ? '27' : '29',
      maxrate: padrao ? '800k' : '430k',
      bufsize: padrao ? '1600k' : '860k'
    }
  };

  const v = configsVelocidade[velocidade] || configsVelocidade.equilibrado;
  return {
    escala: `scale=-2:${padrao ? 720 : 480},fps=${v.fps}`,
    preset: v.preset,
    crf: v.crf,
    maxrate: v.maxrate,
    bufsize: v.bufsize,
    audio: padrao ? '64k' : '48k',
    level: padrao ? '3.1' : '3.0'
  };
}

export const VideoEncoder = {
  podeUsar(arquivo) {
    if (!isDesktop()) return { ok: false, motivo: 'A preparação automática de vídeo está disponível somente em computador.' };
    if (!arquivo) return { ok: false, motivo: 'Selecione um vídeo.' };
    if (arquivo.size > LIMITE_RECOMENDADO_BYTES) {
      return { ok: false, motivo: 'O arquivo ultrapassa 600 MB. Divida a aula ou compacte o vídeo antes do envio.' };
    }
    return { ok: true };
  },

  obterCapacidades() {
    return {
      multithread: self.crossOriginIsolated === true && Number(navigator.hardwareConcurrency || 1) > 1,
      threads: quantidadeThreads(),
      crossOriginIsolated: self.crossOriginIsolated === true
    };
  },

  async prepararAutomaticamente(arquivo, {
    perfil = 'economico',
    velocidade = 'equilibrado',
    onProgress = () => {},
    onLog = () => {},
    onStage = () => {}
  } = {}) {
    const suporte = this.podeUsar(arquivo);
    if (!suporte.ok) throw new Error(suporte.motivo);

    const { ffmpeg, fetchFile, usarMultithread } = await criarInstancia(onLog, onStage);
    const extensao = (arquivo.name.split('.').pop() || 'mp4').toLowerCase();
    const entrada = `entrada-${Date.now()}.${extensao}`;
    const saida = `saida-${Date.now()}.mp4`;
    const nomeFinal = `${nomeSeguro(arquivo.name).replace(/\.[^.]+$/, '')}-pwa.mp4`;
    const threads = usarMultithread ? String(quantidadeThreads()) : '1';

    const listener = ({ progress }) => {
      const percentual = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
      onProgress(percentual);
    };
    ffmpeg.on('progress', listener);

    try {
      onStage('Carregando o vídeo no encoder local...');
      await ffmpeg.writeFile(entrada, await fetchFile(arquivo));
      const config = configPorPerfil(perfil, velocidade);

      try {
        onStage(`Otimizando em modo ${velocidade} para ${perfil === 'padrao' ? '720p' : '480p'}...`);
        await executar(ffmpeg, [
          '-i', entrada,
          '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
          '-vf', config.escala,
          '-threads', threads,
          '-filter_threads', threads,
          '-c:v', 'libx264',
          '-preset', config.preset,
          '-profile:v', 'main', '-level:v', config.level,
          '-pix_fmt', 'yuv420p',
          '-crf', config.crf,
          '-maxrate', config.maxrate, '-bufsize', config.bufsize,
          '-c:a', 'aac', '-b:a', config.audio, '-ar', '44100', '-ac', '1',
          '-af', 'aresample=async=1:first_pts=0',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          saida
        ]);

        const file = await lerSaidaComoArquivo(ffmpeg, saida, nomeFinal);
        return {
          arquivo: file,
          modo: usarMultithread ? 'otimizado-multithread' : 'otimizado-single-thread',
          mensagem: `Vídeo otimizado em modo ${velocidade} para ${perfil === 'padrao' ? '720p' : '480p'} e preparado para streaming.`
        };
      } catch (erroConversao) {
        onLog(`Conversão completa indisponível: ${erroConversao.message}. Tentando faststart sem recodificação.`);
        onStage('Aplicando preparação rápida para streaming...');
        onProgress(0);
        try { await ffmpeg.deleteFile(saida); } catch {}

        await executar(ffmpeg, [
          '-i', entrada,
          '-map', '0:v:0', '-map', '0:a:0?',
          '-c', 'copy', '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          saida
        ]);

        const file = await lerSaidaComoArquivo(ffmpeg, saida, nomeFinal);
        return { arquivo: file, modo: 'streaming', mensagem: 'O vídeo foi preparado para streaming sem recodificação.' };
      }
    } finally {
      try { await ffmpeg.deleteFile(entrada); } catch {}
      try { await ffmpeg.deleteFile(saida); } catch {}
      ffmpeg.off?.('progress', listener);
      try { ffmpeg.terminate(); } catch {}
    }
  }
};
