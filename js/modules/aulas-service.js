import { db, storage } from '../firebase-config.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const COLECAO = 'aulas';
const CACHE_AULAS_KEY = 'chiteroicao_aulas_catalogo_v1';

function normalizarNomeArquivo(nome = 'video.mp4') {
  const partes = String(nome).split('.');
  const extensao = partes.length > 1 ? partes.pop().toLowerCase() : 'mp4';
  const base = partes.join('.') || 'video';
  const seguro = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${seguro || 'video'}.${extensao}`;
}

function limparPayload(valor) {
  if (valor === undefined) return null;
  if (Array.isArray(valor)) return valor.map(limparPayload);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([, item]) => item !== undefined)
        .map(([chave, item]) => [chave, limparPayload(item)])
    );
  }
  return valor;
}

async function listarOrdenado() {
  try {
    const snapshot = await getDocs(query(collection(db, COLECAO), orderBy('ordem', 'asc')));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (erro) {
    console.warn('Não foi possível ordenar aulas por ordem. Usando leitura simples.', erro);
    const snapshot = await getDocs(collection(db, COLECAO));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  }
}

export const AulasService = {
  async listarAulas({ somentePublicadas = false } = {}) {
    let aulas = [];

    try {
      aulas = await listarOrdenado();
      localStorage.setItem(CACHE_AULAS_KEY, JSON.stringify(aulas.map((aula) => ({
        ...aula,
        createdAt: aula.createdAt?.toDate?.()?.toISOString?.() || aula.createdAt || null,
        updatedAt: aula.updatedAt?.toDate?.()?.toISOString?.() || aula.updatedAt || null
      }))));
    } catch (erro) {
      const cache = localStorage.getItem(CACHE_AULAS_KEY);
      if (!cache) throw erro;
      aulas = JSON.parse(cache);
    }

    return somentePublicadas ? aulas.filter((aula) => aula.publicada !== false) : aulas;
  },

  async salvarAula(aula, id = null) {
    const payload = limparPayload({
      titulo: String(aula.titulo || '').trim(),
      descricao: String(aula.descricao || '').trim(),
      modulo: String(aula.modulo || 'Módulo 1').trim(),
      ordem: Number(aula.ordem || 0),
      duracaoSegundos: Number(aula.duracaoSegundos || 0),
      tamanhoBytes: Number(aula.tamanhoBytes || 0),
      videoUrl: aula.videoUrl || '',
      videoPath: aula.videoPath || '',
      thumbnailUrl: aula.thumbnailUrl || '',
      publicada: aula.publicada !== false,
      updatedAt: serverTimestamp()
    });

    if (!payload.titulo) throw new Error('Informe o título da aula.');
    if (!payload.videoUrl) throw new Error('Selecione e envie um vídeo.');

    if (id) {
      await setDoc(doc(db, COLECAO, id), payload, { merge: true });
      return id;
    }

    const criado = await addDoc(collection(db, COLECAO), {
      ...payload,
      createdAt: serverTimestamp()
    });
    return criado.id;
  },

  async excluirAula(aula) {
    if (!aula?.id) return;

    if (aula.videoPath) {
      try {
        await deleteObject(ref(storage, aula.videoPath));
      } catch (erro) {
        console.warn('O vídeo não foi removido do Storage. O documento será excluído mesmo assim.', erro);
      }
    }

    await deleteDoc(doc(db, COLECAO, aula.id));
  },

  async uploadVideo({ arquivo, aulaId = 'nova-aula', onProgress = () => {} }) {
    if (!arquivo) throw new Error('Nenhum vídeo selecionado.');

    const nomeSeguro = normalizarNomeArquivo(arquivo.name || 'video.mp4');
    const path = `aulas/${aulaId}/${Date.now()}-${nomeSeguro}`;
    const storageRef = ref(storage, path);
    const tarefa = uploadBytesResumable(storageRef, arquivo, {
      contentType: arquivo.type || 'video/mp4',
      cacheControl: 'public,max-age=3600'
    });

    await new Promise((resolve, reject) => {
      tarefa.on(
        'state_changed',
        (snapshot) => {
          const total = Math.max(snapshot.totalBytes || 1, 1);
          onProgress(Math.round((snapshot.bytesTransferred / total) * 100));
        },
        reject,
        resolve
      );
    });

    return {
      videoUrl: await getDownloadURL(tarefa.snapshot.ref),
      videoPath: path,
      tamanhoBytes: Number(arquivo.size || 0)
    };
  }
};
