// js/views/view-admin.js

import { db, storage } from '../firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    addDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

function agruparBancoLocalPorProva() {
    /*
        O projeto agora opera 100% via Firestore.
        A antiga migração a partir de assets/data/perguntas.js foi removida
        para permitir excluir a pasta assets/data com segurança.
    */
    return new Map();
}

function escaparHTML(valor = '') {
    return String(valor)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function htmlConteudo(valor = '') {
    return valor || '<span style="color:#94a3b8;font-style:italic;">Não informado</span>';
}

function textoPlanoRichText(valor = '') {
    const bruto = String(valor || '');

    if (!bruto) return '';

    if (typeof document !== 'undefined') {
        const temp = document.createElement('div');
        temp.innerHTML = bruto;

        return (temp.textContent || temp.innerText || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return bruto
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function resumoRichText(valor = '', limite = 120, fallback = 'Não informado') {
    const texto = textoPlanoRichText(valor);

    if (!texto) return fallback;

    if (texto.length <= limite) return texto;

    return `${texto.slice(0, limite).trim()}...`;
}

function pill(texto, bg = '#e0f2fe', color = '#0369a1') {
    return `
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:${bg};color:${color};font-size:11px;font-weight:700;line-height:1;">
            ${texto}
        </span>
    `;
}

function blocoInfo(label, conteudo, extraStyle = '') {
    return `
        <div style="margin-bottom:12px; ${extraStyle}">
            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">
                ${label}
            </div>
            <div style="font-size:14px;color:#0f172a;line-height:1.55;">
                ${conteudo || '<span style="color:#94a3b8;font-style:italic;">Não informado</span>'}
            </div>
        </div>
    `;
}

function midiaPath(path) {
    if (!path) return '<span style="color:#94a3b8;font-style:italic;">Sem mídia</span>';
    return `
        <code style="display:block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;color:#334155;font-size:11px;white-space:normal;word-break:break-word;">
            ${escaparHTML(path)}
        </code>
    `;
}

function normalizarNomeArquivo(nome = 'arquivo') {
    const partes = String(nome).split('.');
    const extensao = partes.length > 1 ? partes.pop().toLowerCase() : '';
    const base = partes.join('.') || nome;

    const seguro = base
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

    return extensao ? `${seguro || 'arquivo'}.${extensao}` : (seguro || 'arquivo');
}

function gerarIdDocumentoBase(titulo = '') {
    const base = String(titulo || 'modelo_prova')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();

    return base || `modelo_prova_${Date.now()}`;
}


function limparDadosFirebase(valor) {
    /*
        Firestore não aceita campos com undefined.
        Este sanitizador remove undefined de objetos/arrays recursivamente
        antes de salvar a prova. Isso evita erro genérico ao salvar interactions,
        especialmente depois de edições ricas em conteúdo e migrações antigas.
    */
    if (valor === undefined) return null;
    if (valor === null) return null;

    if (Array.isArray(valor)) {
        return valor.map((item) => limparDadosFirebase(item));
    }

    if (typeof valor === 'object') {
        const limpo = {};

        Object.entries(valor).forEach(([chave, item]) => {
            if (item !== undefined) {
                limpo[chave] = limparDadosFirebase(item);
            }
        });

        return limpo;
    }

    return valor;
}


export const ViewAdmin = {
    template: `
        
<div class="admin-shell" style="padding: 24px; background: #000; color: #fff; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; min-height: 100vh;">
<style>
    :root {
        --chitero-blue: #5EBBDE;
        --chitero-cyan: #06b6d4;
        --chitero-black: #000000;
        --chitero-dark: #050505;
        --chitero-white: #ffffff;
        --chitero-text: #111827;
        --chitero-muted: #64748b;
        --chitero-border: #e5e7eb;
        --chitero-soft: #f8fafc;
        --chitero-danger: #ef4444;
        --chitero-green: #22c55e;
    }

    .admin-shell {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        box-sizing: border-box;
        background:
            radial-gradient(circle at top center, rgba(94,187,222,.10), transparent 32%),
            #000 !important;
    }

    .admin-shell header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: rgba(0, 0, 0, .94);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255,255,255,.10) !important;
        padding: 18px 0 !important;
        margin-bottom: 24px !important;
    }

    .admin-shell header h1 {
        color: var(--chitero-blue) !important;
        font-size: 1.25rem !important;
        letter-spacing: -.02em;
    }

    #btn-sair-admin {
        background: var(--chitero-danger) !important;
        color: #fff !important;
        border-radius: 10px !important;
        padding: 10px 18px !important;
        transition: transform .18s ease, opacity .18s ease;
    }

    #btn-sair-admin:hover {
        transform: translateY(-1px);
        opacity: .92;
    }

    .admin-tab {
        min-width: 88px;
        border-radius: 999px !important;
        padding: 11px 18px !important;
        font-weight: 800 !important;
        transition: transform .18s ease, background .18s ease, color .18s ease, border-color .18s ease;
    }

    .admin-tab:hover {
        transform: translateY(-1px);
    }

    #secao-alunos,
    #secao-provas {
        max-width: 1080px;
        margin: 0 auto;
    }

    #secao-alunos h2,
    #secao-provas h2 {
        color: #fff !important;
        font-size: 1rem !important;
        letter-spacing: -.01em;
    }

    #secao-provas > div:first-child {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin-bottom: 16px !important;
    }

    #secao-provas > p {
        background: rgba(255,255,255,.96) !important;
        color: #475569 !important;
        border: 1px solid var(--chitero-border) !important;
        border-radius: 14px !important;
        padding: 12px 14px !important;
        line-height: 1.5 !important;
    }

    #grid-provas,
    #grid-solicitacoes,
    #grid-pilotos {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 14px !important;
    }



    .banco-fase-section {
        background: #ffffff !important;
        color: #111827 !important;
        border: 1px solid var(--chitero-border) !important;
        border-radius: 18px !important;
        padding: 18px !important;
        box-shadow: 0 18px 45px rgba(15,23,42,.12);
        margin-bottom: 18px;
    }

    .banco-fase-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
    }

    .banco-fase-header h3 {
        margin: 0;
        color: #0f172a;
        font-size: 18px;
    }

    .banco-fase-header p {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 12px;
        line-height: 1.45;
    }

    .banco-fase-lista {
        display: grid;
        gap: 10px;
    }

    .banco-fase-lista-full {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .banco-interaction-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 14px;
        display: grid;
        gap: 10px;
    }

    .banco-interaction-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
        padding-bottom: 10px;
        border-bottom: 1px solid #e2e8f0;
    }

    .banco-interaction-header h4 {
        margin: 0;
        color: #0f172a;
        font-size: 15px;
        line-height: 1.35;
    }

    .banco-interaction-header p {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 12px;
        line-height: 1.45;
    }

    .banco-interaction-lista {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .banco-questao-card {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 14px;
        background: #f8fafc;
        display: grid;
        gap: 10px;
    }

    .btn-banco-cadastrar,
    .btn-banco-visualizar,
    .btn-banco-editar {
        background: var(--chitero-blue) !important;
        color: #fff !important;
        border: none !important;
    }

    .btn-banco-duplicar {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
    }

    .btn-banco-excluir {
        background: #fee2e2 !important;
        color: #991b1b !important;
        border: 1px solid #fecaca !important;
    }

    #grid-provas > div,
    #grid-solicitacoes > div,
    #grid-pilotos > div {
        background: #ffffff !important;
        color: var(--chitero-text) !important;
        border: 1px solid var(--chitero-border) !important;
        border-radius: 18px !important;
        padding: 18px !important;
        box-shadow: 0 18px 45px rgba(15,23,42,.12);
        transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
    }

    #grid-provas > div:hover,
    #grid-solicitacoes > div:hover,
    #grid-pilotos > div:hover {
        transform: translateY(-2px);
        border-color: rgba(94,187,222,.65) !important;
        box-shadow: 0 24px 60px rgba(15,23,42,.18);
    }

    #grid-provas > div div,
    #grid-solicitacoes > div div,
    #grid-pilotos > div div {
        color: inherit;
    }

    #grid-provas > div div[style*="color:#f8fafc"],
    #grid-solicitacoes > div div[style*="color: #f8fafc"],
    #grid-pilotos > div div[style*="color: #f8fafc"] {
        color: #111827 !important;
    }

    #grid-provas > div div[style*="color:#94a3b8"],
    #grid-solicitacoes > div div[style*="color: #94a3b8"],
    #grid-pilotos > div div[style*="color: #94a3b8"] {
        color: #64748b !important;
    }

    #grid-solicitacoes select {
        background: #fff !important;
        color: #111827 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 10px !important;
    }

    #grid-provas button,
    #grid-solicitacoes button,
    #grid-pilotos button,
    #secao-provas > div:first-child button {
        border-radius: 10px !important;
        font-weight: 800 !important;
        min-height: 38px;
        transition: transform .18s ease, opacity .18s ease, filter .18s ease;
    }

    #grid-provas button:hover,
    #grid-solicitacoes button:hover,
    #grid-pilotos button:hover,
    #secao-provas > div:first-child button:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
    }

    #btn-criar-prova,
    .btn-editar-prova,
    #btn-confirmar-criar-prova,
    #btn-salvar-prova,
    #btn-salvar-edicao-fase1,
    #btn-salvar-edicao-fase2,
    #btn-salvar-edicao-fase3,
    #btn-salvar-edicao-fase4,
    .btn-cms-editar,
    .btn-cms-adicionar {
        background: var(--chitero-blue) !important;
        color: #fff !important;
        border: none !important;
    }

    #btn-migrar-perguntas,
    .btn-acao[data-acao="Ativar"],
    .btn-toggle-prova[style*="#16a34a"] {
        background: var(--chitero-green) !important;
        color: #fff !important;
        border: none !important;
    }

    .btn-toggle-prova {
        background: #111827 !important;
        color: #fff !important;
        border: none !important;
    }

    .btn-excluir-prova,
    .btn-cms-excluir {
        background: var(--chitero-danger) !important;
        color: #fff !important;
        border: none !important;
    }

    .btn-cms-duplicar {
        background: #f8fafc !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
    }

    #modal-prova {
        background: rgba(0,0,0,.78) !important;
        backdrop-filter: blur(4px);
    }

    #modal-prova > div {
        width: min(96vw, 1120px);
        max-width: 1120px !important;
        background: #ffffff !important;
        color: #111827 !important;
        border: 1px solid var(--chitero-border) !important;
        border-radius: 20px !important;
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
    }

    #modal-prova h3,
    #modal-prova h2,
    #modal-prova label {
        color: #111827 !important;
    }

    #btn-fechar-modal-prova {
        background: #f8fafc !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 10px !important;
    }

    #form-json-prova input,
    #form-json-prova textarea,
    #nova-prova-titulo,
    #nova-prova-id {
        background: #ffffff !important;
        color: #111827 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 10px !important;
    }

    #preview-prova-admin-container > div {
        background: #ffffff !important;
        border-radius: 18px !important;
    }

    #preview-prova-admin-container section {
        border-radius: 16px !important;
    }

    #preview-prova-admin-container article {
        border-radius: 16px !important;
    }

    .btn-richtext {
        border-radius: 8px !important;
    }


    .campo-richtext-admin,
    .campo-richtext-admin p,
    .campo-richtext-admin div,
    .campo-richtext-admin li {
        font-size: 14px;
        line-height: 1.6;
    }

    .campo-richtext-admin ul,
    .campo-richtext-admin ol {
        padding-left: 24px;
        margin: 8px 0;
    }

    .campo-richtext-admin:empty:before {
        content: attr(data-placeholder);
        color: #94a3b8;
        font-style: italic;
    }

    .richtext-toolbar select,
    .richtext-toolbar button {
        min-height: 34px;
    }

    .btn-richtext.is-active {
        background: #0f172a !important;
        color: #ffffff !important;
        border-color: #0f172a !important;
        box-shadow: 0 0 0 2px rgba(94,187,222,.18);
    }

    .select-richtext-fontsize {
        min-width: 128px;
    }

    .banco-fase-controles {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin: 10px 0 14px 0;
        padding: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: #f8fafc;
    }

    .banco-fase-search {
        flex: 1;
        min-width: 240px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 11px 12px;
        font-size: 13px;
        color: #0f172a;
        background: #ffffff;
        outline: none;
        box-sizing: border-box;
    }

    .banco-fase-search:focus {
        border-color: var(--chitero-blue);
        box-shadow: 0 0 0 3px rgba(94,187,222,.18);
    }

    .banco-fase-count {
        white-space: nowrap;
        color: #475569;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 800;
    }

    .banco-fase-lista-scroll {
        max-height: 620px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 6px;
        scroll-behavior: smooth;
    }

    .banco-fase-lista-scroll::-webkit-scrollbar,
    .banco-interaction-lista::-webkit-scrollbar {
        width: 8px;
    }

    .banco-fase-lista-scroll::-webkit-scrollbar-track,
    .banco-interaction-lista::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 999px;
    }

    .banco-fase-lista-scroll::-webkit-scrollbar-thumb,
    .banco-interaction-lista::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 999px;
    }

    .banco-fase-lista-scroll::-webkit-scrollbar-thumb:hover,
    .banco-interaction-lista::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    .banco-questao-card[data-search-hidden="true"],
    .banco-interaction-section[data-search-hidden="true"] {
        display: none !important;
    }


    .campo-richtext-admin,
    .campo-richtext-admin p,
    .campo-richtext-admin div,
    .campo-richtext-admin li,
    .conteudo-formatado-admin,
    .conteudo-formatado-admin p,
    .conteudo-formatado-admin div,
    .conteudo-formatado-admin li {
        font-size: 14px;
        line-height: 1.65;
    }

    .campo-richtext-admin p,
    .conteudo-formatado-admin p {
        margin: 0 0 14px 0;
        min-height: 1em;
    }

    .campo-richtext-admin p:has(br),
    .conteudo-formatado-admin p:has(br) {
        min-height: 1.2em;
        margin-bottom: 14px;
    }

    .campo-richtext-admin div,
    .conteudo-formatado-admin div {
        margin-bottom: 12px;
        min-height: 1em;
    }

    .campo-richtext-admin ul,
    .campo-richtext-admin ol,
    .conteudo-formatado-admin ul,
    .conteudo-formatado-admin ol {
        padding-left: 24px;
        margin: 8px 0 14px 0;
    }

    .campo-richtext-admin:empty:before {
        content: attr(data-placeholder);
        color: #94a3b8;
        font-style: italic;
    }

    .richtext-toolbar select,
    .richtext-toolbar button {
        min-height: 34px;
    }

    @media (min-width: 880px) {
        #grid-provas {
            grid-template-columns: 1fr !important;
        }

        #grid-solicitacoes,
        #grid-pilotos {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
    }

    @media (max-width: 760px) {
        .admin-shell {
            padding: 14px !important;
        }

        .admin-shell header {
            flex-direction: column;
            align-items: stretch !important;
            gap: 14px;
            padding-top: 12px !important;
        }

        .admin-shell header h1 {
            text-align: center;
            font-size: 1.08rem !important;
        }

        #btn-sair-admin {
            width: 100%;
        }

        .admin-tab {
            flex: 1;
            justify-content: center;
            text-align: center;
        }

        #secao-provas > div:first-child {
            align-items: stretch !important;
        }

        #secao-provas > div:first-child > div {
            width: 100%;
        }

        #secao-provas > div:first-child button,
        #grid-provas button,
        #grid-solicitacoes button,
        #grid-pilotos button {
            width: 100%;
        }

        #grid-provas > div,
        #grid-solicitacoes > div,
        #grid-pilotos > div {
            padding: 14px !important;
        }

        #modal-prova {
            padding: 8px !important;
        }

        #modal-prova > div {
            margin: 8px auto !important;
            padding: 12px !important;
            border-radius: 16px !important;
            width: 100% !important;
        }

        #preview-prova-admin-container > div {
            padding: 10px !important;
        }

        #preview-prova-admin-container article > div:first-child {
            flex-direction: column;
        }

        #preview-prova-admin-container article button,
        #preview-prova-admin-container section button {
            width: 100%;
        }

        #editor-fase1-modal,
        #editor-fase2-modal,
        #editor-fase3-modal,
        #editor-fase4-modal {
            align-items: flex-start !important;
            padding: 8px !important;
        }

        #editor-fase1-modal > div,
        #editor-fase2-modal > div,
        #editor-fase3-modal > div,
        #editor-fase4-modal > div {
            max-height: calc(100vh - 16px) !important;
            border-radius: 16px !important;
            padding: 14px !important;
        }
    }


    /* Banco de Questões sempre em fluxo vertical de largura total. */
    #grid-provas {
        grid-template-columns: 1fr !important;
        width: 100%;
    }

    #grid-provas > .banco-fase-section,
    #grid-provas > .banco-resumo-section {
        width: 100%;
        box-sizing: border-box;
        grid-column: 1 / -1;
    }

    @media (max-width: 430px) {
        .admin-shell {
            padding: 10px !important;
        }

        #secao-alunos h2,
        #secao-provas h2 {
            font-size: .98rem !important;
        }

        #grid-provas,
        #grid-solicitacoes,
        #grid-pilotos {
            gap: 10px !important;
        }
    }
</style>

            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 15px;">
                <h1 style="font-size: 1.2rem; margin: 0; color: #5EBBDE;">Painel Administrativo</h1>
                <button id="btn-sair-admin" style="background: #e74c3c; color: #fff; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">Sair</button>
            </header>

            <div style="display: flex; gap: 10px; margin-bottom: 22px; flex-wrap: wrap;">
                <button id="tab-alunos" class="admin-tab" data-tab="alunos" style="background:#06b6d4;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer;">Alunos</button>
                <button id="tab-provas" class="admin-tab" data-tab="provas" style="background:#0f172a;color:#94a3b8;border:1px solid #1e293b;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer;">Banco de Questões</button>
            </div>

            <section id="secao-alunos">
                <h2 style="font-size: 1rem; color: #FFF; margin-bottom: 15px;">Solicitações</h2>
                <div id="grid-solicitacoes" style="display: grid; gap: 12px;"></div>

                <h2 style="font-size: 1rem; color: #FFF; margin-top: 30px; margin-bottom: 15px;">Pilotos Ativos</h2>
                <div id="grid-pilotos" style="display: grid; gap: 12px;"></div>
            </section>

            <section id="secao-provas" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:15px; flex-wrap:wrap;">
                    <h2 style="font-size: 1rem; color: #FFF; margin:0;">Banco de Questões por Fase</h2>
                </div>
                <div id="grid-provas" style="display:grid; gap:12px;"></div>
            </section>

            <div id="modal-prova" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.72); z-index:9999; padding:18px; box-sizing:border-box; overflow:auto;">
                <div style="max-width:960px; margin:20px auto; background:#0f172a; border:1px solid #334155; border-radius:14px; padding:18px; box-sizing:border-box;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;">
                        <h3 id="modal-prova-titulo" style="margin:0;color:#fff;font-size:1rem;">Editar prova</h3>
                        <button id="btn-fechar-modal-prova" style="background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:6px;padding:7px 10px;cursor:pointer;">Fechar</button>
                    </div>

                    <div id="form-json-prova">
                        <label style="display:block;color:#cbd5e1;font-size:.85rem;margin-bottom:6px;">Título da prova</label>
                        <input id="prova-titulo" style="width:100%;box-sizing:border-box;padding:11px;background:#020617;color:#fff;border:1px solid #334155;border-radius:8px;margin-bottom:12px;" placeholder="Ex: Modelo Prova Alpha">

                        <label style="display:flex;align-items:center;gap:8px;color:#cbd5e1;font-size:.85rem;margin-bottom:12px;">
                            <input type="checkbox" id="prova-ativa" checked>
                            Prova ativa para alunos
                        </label>

                        <label style="display:block;color:#cbd5e1;font-size:.85rem;margin-bottom:6px;">Estrutura JSON da prova</label>
                        <textarea id="prova-json" spellcheck="false" style="width:100%;min-height:420px;box-sizing:border-box;padding:12px;background:#020617;color:#d1fae5;border:1px solid #334155;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;"></textarea>

                        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;">
                            <button id="btn-validar-json-prova" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:10px 14px;font-weight:700;cursor:pointer;">Validar JSON</button>
                            <button id="btn-salvar-prova" style="background:#06b6d4;color:#fff;border:none;border-radius:6px;padding:10px 14px;font-weight:700;cursor:pointer;">Salvar prova</button>
                        </div>
                    </div>

                    <div id="preview-prova-admin-container"></div>
                </div>
            </div>
        </div>
    `,

    estado: {
        tabAtiva: 'alunos',
        provaEmEdicaoId: null,
        provaEmPreview: null,

        faseAtual: null,
        indiceAtual: null
    },

    init(callbacks = {}) {
        this.callbacks = callbacks;
        this.vincularEventosBase();
        this.renderizarDados();
    },

    vincularEventosBase() {
        document.getElementById('btn-sair-admin')?.addEventListener('click', async () => {
            if (this.callbacks?.onLogout) {
                await this.callbacks.onLogout();
            } else {
                await signOut(getAuth());
            }
            location.reload();
        });

        document.querySelectorAll('.admin-tab').forEach((btn) => {
            btn.addEventListener('click', () => this.alternarTab(btn.dataset.tab));
        });

        document.getElementById('btn-criar-prova')?.addEventListener('click', async () => { await this.garantirBancoPadrao(); this.renderizarProvas(); alert('Banco padrão criado/verificado com sucesso.'); });
        document.getElementById('btn-migrar-perguntas')?.addEventListener('click', () => this.migrarPerguntasLocalParaFirebase());
        document.getElementById('btn-fechar-modal-prova')?.addEventListener('click', () => this.fecharModalProva());
        document.getElementById('btn-validar-json-prova')?.addEventListener('click', () => this.validarJsonProva());
        document.getElementById('btn-salvar-prova')?.addEventListener('click', () => this.salvarProvaAtual());
    },

    alternarTab(tab) {
        this.estado.tabAtiva = tab;
        document.getElementById('secao-alunos').style.display = tab === 'alunos' ? 'block' : 'none';
        document.getElementById('secao-provas').style.display = tab === 'provas' ? 'block' : 'none';

        document.querySelectorAll('.admin-tab').forEach((btn) => {
            const ativa = btn.dataset.tab === tab;
            btn.style.background = ativa ? '#06b6d4' : '#0f172a';
            btn.style.color = ativa ? '#fff' : '#94a3b8';
            btn.style.border = ativa ? 'none' : '1px solid #1e293b';
        });

        if (tab === 'provas') this.renderizarProvas();
    },

    calcularDataExpiracao(dias) {
        const data = new Date();
        data.setDate(data.getDate() + parseInt(dias, 10));
        return data.toISOString();
    },

    async renderizarDados() {
        try {
            const snapshot = await getDocs(collection(db, 'usuarios'));
            const gSol = document.getElementById('grid-solicitacoes');
            const gPil = document.getElementById('grid-pilotos');
            if (!gSol || !gPil) return;

            gSol.innerHTML = '';
            gPil.innerHTML = '';

            let temSolicitacoes = false;
            let temPilotos = false;

            snapshot.forEach(docSnap => {
                const u = docSnap.data();
                if (u.perfil === 'admin') return;

                const isAtivo = u.status === 'ativo';
                const card = document.createElement('div');
                card.style.cssText = 'background:#0f172a;padding:15px;border-radius:10px;border:1px solid #1e293b;display:flex;flex-direction:column;gap:10px;';

                card.innerHTML = `
                    <div style="font-size: 0.9rem; font-weight: 600; color: #f8fafc;">${u.email || 'Sem e-mail'}</div>
                    ${!isAtivo ? `
                        <select id="prazo-${docSnap.id}" style="width: 100%; padding: 10px; background: #020617; color: #fff; border: 1px solid #334155; border-radius: 6px;">
                            <option value="7">7 Dias</option>
                            <option value="30" selected>30 Dias</option>
                            <option value="90">90 Dias</option>
                        </select>
                        <button class="btn-acao" data-id="${docSnap.id}" data-acao="Ativar" style="background: #06b6d4; border: none; color: #fff; padding: 12px; border-radius: 6px; font-weight: bold; cursor:pointer;">Ativar Piloto</button>
                    ` : `
                        <div style="font-size: 0.8rem; color: #94a3b8;">Expira em: ${u.tokenExpiracao ? new Date(u.tokenExpiracao).toLocaleDateString('pt-BR') : 'N/A'}</div>
                        <button class="btn-acao" data-id="${docSnap.id}" data-acao="Inativar" style="background: transparent; border: 1px solid red; color: #999; padding: 10px; border-radius: 6px; font-weight: bold; cursor:pointer;">Inativar</button>
                    `}
                `;

                if (!isAtivo) {
                    gSol.appendChild(card);
                    temSolicitacoes = true;
                } else {
                    gPil.appendChild(card);
                    temPilotos = true;
                }
            });

            if (!temSolicitacoes) {
                gSol.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; font-style: italic; padding: 10px;">Não há novas solicitações no momento.</p>';
            }
            if (!temPilotos) {
                gPil.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; font-style: italic; padding: 10px;">Nenhum piloto ativo.</p>';
            }

            this.vincularBotoesAlunos();
        } catch (erro) {
            console.error('Erro ao carregar usuários:', erro);
            alert('Não foi possível carregar os usuários. Verifique sua conexão e permissões do Firebase.');
        }
    },

    vincularBotoesAlunos() {
        document.querySelectorAll('.btn-acao').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const acao = e.target.dataset.acao;
            const update = {
                aprovado: acao === 'Ativar',
                status: acao === 'Ativar' ? 'ativo' : 'inativo',
                updatedAt: new Date().toISOString()
            };

            if (acao === 'Ativar') {
                update.tipoExpiracao = 'temporario';
                update.tokenExpiracao = this.calcularDataExpiracao(document.getElementById(`prazo-${id}`).value);
            }

            await updateDoc(doc(db, 'usuarios', id), update);
            this.renderizarDados();
        }));
    },

    async renderizarProvas() {
        const grid = document.getElementById('grid-provas');
        if (!grid) return;

        grid.innerHTML = '<p style="color:#94a3b8;">Carregando banco de questões...</p>';

        try {
            const snapshot = await getDocs(collection(db, 'provas'));
            const provas = [];

            snapshot.forEach((docSnap) => {
                const prova = { id: docSnap.id, ...docSnap.data() };
                provas.push(prova);
            });

            const banco = this.montarBancoQuestoesPorFase(provas);
            const total = ['fase1', 'fase2', 'fase3', 'fase4'].reduce((acc, fase) => acc + banco[fase].length, 0);

            if (!total) {
                grid.innerHTML = `
                    <div class="banco-fase-section">
                        <h3 style="margin:0 0 8px 0;color:#0f172a;">Nenhuma questão cadastrada</h3>
                        <p style="margin:0 0 14px 0;color:#64748b;font-size:13px;line-height:1.5;">
                            Use os botões de cadastro por fase para começar o banco de questões, ou cadastre as questões pelo painel.
                        </p>
                        <button class="btn-banco-cadastrar" data-fase="fase1" style="border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;">
                            + Cadastrar primeira questão
                        </button>
                    </div>
                `;
                grid.querySelector('.btn-banco-cadastrar')?.addEventListener('click', () => this.adicionarQuestaoBanco('fase1'));
                return;
            }

            grid.innerHTML = `
                <div class="banco-resumo-section" style="background:rgba(255,255,255,.96);border:1px solid #e5e7eb;border-radius:16px;padding:14px;color:#0f172a;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                        <div>
                            <h3 style="margin:0;color:#0f172a;font-size:18px;">Banco de Questões</h3>
                            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;line-height:1.45;">
                                As questões ficam separadas por fase. O simulado sorteia perguntas de todo o banco, mantendo a tela do aluno igual.
                            </p>
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${pill(`${banco.fase1.length} Fase 1`, '#e0f2fe', '#0369a1')}
                            ${pill(`${banco.fase2.length} Fase 2`, '#fef3c7', '#92400e')}
                            ${pill(`${banco.fase3.length} Fase 3`, '#ffedd5', '#9a3412')}
                            ${pill(`${banco.fase4.length} Fase 4`, '#ede9fe', '#5b21b6')}
                        </div>
                    </div>
                </div>
                ${this.renderizarSecaoBancoFase('fase1', 'Fase 1 — Aviation Topics', 'Perguntas abertas de rotina, experiência e preparação do piloto.', banco.fase1)}
                ${this.renderizarSecaoBancoFase('fase2', 'Fase 2 — Interacting as a Pilot', 'Interações 1 a 5. As interações 4 e 5 continuam sendo as interações com imagem.', banco.fase2)}
                ${this.renderizarSecaoBancoFase('fase3', 'Fase 3 — Unexpected Situations', 'Blocos com três situações e uma comparação final.', banco.fase3)}
                ${this.renderizarSecaoBancoFase('fase4', 'Fase 4 — Picture Description', 'Photos com descrição, perguntas operacionais e statement.', banco.fase4)}
            `;

            this.vincularEventosBancoQuestoes(grid);
        } catch (erro) {
            console.error('Erro ao carregar banco de questões:', erro);
            grid.innerHTML = '<p style="color:#ef4444;">Erro ao carregar banco de questões. Verifique conexão e permissões.</p>';
        }
    },

    montarBancoQuestoesPorFase(provas = []) {
        const banco = {
            fase1: [],
            fase2: [],
            fase3: [],
            fase4: []
        };

        provas
            .filter((prova) => prova && prova.ativa !== false)
            .forEach((prova) => {
                const fases = prova.fases || prova;

                ['fase1', 'fase2', 'fase3', 'fase4'].forEach((fase) => {
                    const lista = Array.isArray(fases[fase]) ? fases[fase] : [];

                    lista.forEach((item, index) => {
                        banco[fase].push({
                            fase,
                            provaId: prova.id,
                            provaTitulo: prova.titulo || prova.id,
                            index,
                            item
                        });
                    });
                });
            });

        banco.fase2.sort((a, b) => Number(a.item?.interacao || 0) - Number(b.item?.interacao || 0));

        return banco;
    },

    renderizarSecaoBancoFase(fase, titulo, subtitulo, itens = []) {
        const corpo = fase === 'fase2'
            ? this.renderizarFase2BancoPorInteraction(itens)
            : (itens.length
                ? itens.map((registro, ordem) => this.renderizarCardBancoQuestao(registro, ordem)).join('')
                : `<p style="color:#94a3b8;font-size:13px;margin:0;">Nenhuma questão cadastrada nesta fase.</p>`);

        const botaoTopo = fase === 'fase2'
            ? `

            `
            : `
                <button class="btn-banco-cadastrar" data-fase="${fase}" style="border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;">
                    + Cadastrar ${this.obterNomeCurtoFase(fase)}
                </button>
            `;

        return `
            <section class="banco-fase-section" data-fase="${fase}">
                <div class="banco-fase-header">
                    <div>
                        <h3>${titulo}</h3>
                        <p>${subtitulo}</p>
                    </div>
                    ${botaoTopo}
                </div>

                <div class="banco-fase-controles">
                    <input class="banco-fase-search" data-fase="${fase}" type="search" placeholder="Buscar nesta fase..." autocomplete="off">
                    <span class="banco-fase-count" data-fase="${fase}">Mostrando ${itens.length} de ${itens.length} item(ns)</span>
                </div>

                <div class="banco-fase-lista-scroll" data-fase="${fase}">
                    <div class="banco-fase-lista-full">
                        ${corpo}
                    </div>
                </div>
            </section>
        `;
    },

    renderizarFase2BancoPorInteraction(itens = []) {
        const grupos = new Map();
        for (let i = 1; i <= 5; i++) grupos.set(i, []);

        itens.forEach((registro) => {
            const n = Number(registro?.item?.interacao || 0);
            const interacao = n >= 1 && n <= 5 ? n : 1;
            grupos.get(interacao).push(registro);
        });

        return [1, 2, 3, 4, 5].map((interacao) => {
            const lista = grupos.get(interacao) || [];
            const exigeImagem = [4, 5].includes(interacao);
            const cards = lista.length
                ? lista.map((registro, ordem) => this.renderizarCardBancoQuestao(registro, ordem)).join('')
                : `<p style="color:#94a3b8;font-size:13px;margin:0;">Nenhuma pergunta cadastrada para esta interaction.</p>`;

            return `
                <div class="banco-interaction-section" data-interacao="${interacao}">
                    <div class="banco-interaction-header">
                        <div>
                            <h4>Interaction ${interacao}</h4>
                            <p>${exigeImagem ? 'Esta interaction deve conter imagem no bloco Problem.' : 'Interaction sem imagem obrigatória no Problem.'}</p>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                            ${pill(`${lista.length} pergunta(s)`, exigeImagem ? '#fef3c7' : '#e0f2fe', exigeImagem ? '#92400e' : '#0369a1')}
                            ${exigeImagem ? pill('Imagem obrigatória', '#ffedd5', '#9a3412') : ''}
                            <button class="btn-banco-cadastrar" data-fase="fase2" data-interacao="${interacao}" style="border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;">
                                + Cadastrar Interaction ${interacao}
                            </button>
                        </div>
                    </div>
                    <div class="banco-interaction-lista">
                        ${cards}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderizarCardBancoQuestao(registro, ordem = 0) {
        const { fase, provaId, provaTitulo, index, item } = registro;
        const titulo = this.obterTituloResumoQuestao(fase, item, ordem);
        const resumo = this.obterResumoQuestao(fase, item);
        const badges = this.obterBadgesQuestao(fase, item, provaTitulo);

        const textoBusca = this.obterTextoBuscaRegistro(registro, titulo, resumo, badges);

        return `
            <article class="banco-questao-card" data-search-text="${escaparHTML(textoBusca)}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div style="min-width:0;flex:1;">
                        <h4 style="margin:0 0 6px 0;color:#0f172a;font-size:15px;line-height:1.35;">${escaparHTML(titulo)}</h4>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${badges}</div>
                        <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${resumo}</p>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                        <button class="btn-banco-visualizar" data-fase="${fase}" data-prova-id="${escaparHTML(provaId)}" data-index="${index}" style="border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            Visualizar / editar
                        </button>
                        <button class="btn-banco-duplicar" data-fase="${fase}" data-prova-id="${escaparHTML(provaId)}" data-index="${index}" style="border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            Duplicar
                        </button>
                        <button class="btn-banco-excluir" data-fase="${fase}" data-prova-id="${escaparHTML(provaId)}" data-index="${index}" style="border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            Excluir
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    obterTextoBuscaRegistro(registro = {}, titulo = '', resumo = '', badges = '') {
        const item = registro.item || {};
        const partes = [
            registro.fase,
            registro.provaId,
            registro.provaTitulo,
            titulo,
            resumo,
            textoPlanoRichText(badges),
            textoPlanoRichText(JSON.stringify(item || {}))
        ];

        return partes
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
    },

    normalizarTextoBusca(valor = '') {
        return String(valor || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .trim();
    },

    aplicarBuscaNaFase(secao, termoBruto = '') {
        if (!secao) return;

        const termo = this.normalizarTextoBusca(termoBruto);
        const cards = Array.from(secao.querySelectorAll('.banco-questao-card'));
        let visiveis = 0;

        cards.forEach((card) => {
            const texto = card.dataset.searchText || this.normalizarTextoBusca(card.innerText || '');
            const mostrar = !termo || texto.includes(termo);
            card.dataset.searchHidden = mostrar ? 'false' : 'true';
            if (mostrar) visiveis += 1;
        });

        secao.querySelectorAll('.banco-interaction-section').forEach((grupo) => {
            const cardsGrupo = Array.from(grupo.querySelectorAll('.banco-questao-card'));

            if (!cardsGrupo.length) {
                grupo.dataset.searchHidden = termo ? 'true' : 'false';
                return;
            }

            const algumVisivel = cardsGrupo.some((card) => card.dataset.searchHidden !== 'true');
            grupo.dataset.searchHidden = algumVisivel ? 'false' : 'true';
        });

        const count = secao.querySelector('.banco-fase-count');
        if (count) {
            count.innerText = `Mostrando ${visiveis} de ${cards.length} item(ns)`;
        }
    },

    vincularBuscaBancoQuestoes(container) {
        container.querySelectorAll('.banco-fase-search').forEach((input) => {
            const secao = input.closest('.banco-fase-section');
            this.aplicarBuscaNaFase(secao, input.value || '');

            input.addEventListener('input', () => {
                this.aplicarBuscaNaFase(secao, input.value || '');
            });
        });
    },

    obterNomeCurtoFase(fase) {
        const mapa = {
            fase1: 'questão',
            fase2: 'interaction',
            fase3: 'bloco',
            fase4: 'photo'
        };
        return mapa[fase] || 'item';
    },

    obterTituloResumoQuestao(fase, item = {}, ordem = 0) {
        if (fase === 'fase1') {
            return `Questão ${ordem + 1} — ${resumoRichText(item.tituloContexto, 90, 'Aviation Topic')}`;
        }

        if (fase === 'fase2') {
            const titulo = item.scenario || item.cenario || item.tituloContexto || 'Interacting as a Pilot';
            return `Interaction ${Number(item.interacao || ordem + 1)} — ${resumoRichText(titulo, 90, 'Interacting as a Pilot')}`;
        }

        if (fase === 'fase3') {
            const primeira = item.conteudo?.[0]?.titulo || '';
            return `Bloco ${ordem + 1} — ${resumoRichText(primeira, 90, `${(item.conteudo || []).length || 0} situações`)}`;
        }

        if (fase === 'fase4') {
            const desc = item.descricaoHtml || '';
            return `Photo ${ordem + 1} — ${resumoRichText(desc, 90, item.imageUrl ? 'com imagem' : 'sem imagem')}`;
        }

        return `Item ${ordem + 1}`;
    },

    obterResumoQuestao(fase, item = {}) {
        if (fase === 'fase1') {
            return escaparHTML(resumoRichText(item.modeloResposta, 180, 'Sem modelo de resposta informado.'));
        }

        if (fase === 'fase2') {
            const normalizada = this.normalizarInteracaoFase2(item, Number(item.interacao || 1) - 1);
            const audios = normalizada.audios || [];
            const problem = audios.find((audio) => audio.problem)?.problem || '';
            const temImagem = audios.some((audio) => audio.imageUrl);
            const textoProblem = problem ? ` • ${resumoRichText(problem, 130, '')}` : '';

            return escaparHTML(`${audios.length} áudio(s)${temImagem ? ' • com imagem' : ''}${textoProblem}`);
        }

        if (fase === 'fase3') {
            const primeira = item.conteudo?.[0]?.titulo || '';
            return escaparHTML(resumoRichText(primeira, 180, 'Bloco com situações e comparação.'));
        }

        if (fase === 'fase4') {
            return escaparHTML(resumoRichText(item.descricaoHtml, 160, 'Photo com perguntas e statement.'));
        }

        return '';
    },

    obterBadgesQuestao(fase, item = {}, provaTitulo = '') {
        const origem = pill(provaTitulo || 'Banco', '#f1f5f9', '#475569');

        if (fase === 'fase2') {
            const interacao = Number(item.interacao || 0);
            const imagem = [4, 5].includes(interacao);
            return `${pill(`Interaction ${interacao || '?'}`, imagem ? '#fef3c7' : '#e0f2fe', imagem ? '#92400e' : '#0369a1')} ${imagem ? pill('Imagem obrigatória', '#ffedd5', '#9a3412') : ''} ${origem}`;
        }

        if (fase === 'fase3') return `${pill(`${(item.conteudo || []).length || 0} situações`, '#ffedd5', '#9a3412')} ${origem}`;
        if (fase === 'fase4') return `${item.imageUrl ? pill('Imagem', '#dcfce7', '#166534') : pill('Sem imagem', '#fee2e2', '#991b1b')} ${origem}`;

        return `${pill('Aviation Topics')} ${origem}`;
    },

    vincularEventosBancoQuestoes(container) {
        this.vincularBuscaBancoQuestoes(container);

        container.querySelectorAll('.btn-banco-cadastrar').forEach((btn) => {
            btn.addEventListener('click', () => this.adicionarQuestaoBanco(btn.dataset.fase, Number(btn.dataset.interacao || 0)));
        });

        container.querySelectorAll('.btn-banco-visualizar').forEach((btn) => {
            btn.addEventListener('click', () => this.abrirItemBanco(btn.dataset.fase, btn.dataset.provaId, Number(btn.dataset.index)));
        });

        container.querySelectorAll('.btn-banco-duplicar').forEach((btn) => {
            btn.addEventListener('click', () => this.duplicarItemBanco(btn.dataset.fase, btn.dataset.provaId, Number(btn.dataset.index)));
        });

        container.querySelectorAll('.btn-banco-excluir').forEach((btn) => {
            btn.addEventListener('click', () => this.excluirItemBanco(btn.dataset.fase, btn.dataset.provaId, Number(btn.dataset.index)));
        });
    },

    async carregarProvaPorId(provaId) {
        const snapshot = await getDocs(collection(db, 'provas'));
        let encontrada = null;

        snapshot.forEach((docSnap) => {
            if (docSnap.id === provaId) {
                encontrada = { id: docSnap.id, ...docSnap.data() };
            }
        });

        return encontrada;
    },

    async garantirBancoPadrao() {
        const id = 'banco_questoes';
        let prova = await this.carregarProvaPorId(id);

        if (!prova) {
            const payload = {
                titulo: 'Banco de Questões',
                ativa: true,
                origem: 'banco_questoes_cms',
                fases: {
                    fase1: [],
                    fase2: [],
                    fase3: [],
                    fase4: []
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'provas', id), payload, { merge: false });
            prova = { id, ...payload };
        }

        prova.fases ||= { fase1: [], fase2: [], fase3: [], fase4: [] };
        ['fase1', 'fase2', 'fase3', 'fase4'].forEach((fase) => {
            prova.fases[fase] ||= [];
        });

        return prova;
    },

    async adicionarQuestaoBanco(fase, interacaoPredefinida = 0) {
        const prova = await this.garantirBancoPadrao();
        this.estado.provaEmPreview = prova;
        this.estado.provaEmEdicaoId = prova.id;

        let novoItem;

        if (fase === 'fase1') {
            novoItem = {
                idProva: prova.id,
                tituloContexto: 'Nova pergunta da Fase 1',
                modeloResposta: '<p>Escreva aqui o modelo de resposta.</p>'
            };
        } else if (fase === 'fase2') {
            const valorBase = Number(interacaoPredefinida || 0);
            const interacaoEscolhida = valorBase || Number(prompt('Informe o número da Interaction (1 a 5):', '1') || 1);
            const interacao = Math.min(Math.max(interacaoEscolhida, 1), 5);
            novoItem = {
                idProva: prova.id,
                interacao,
                blocoLinear: true,
                scenario: 'Novo scenario da interaction.',
                audios: [
                    {
                        titulo: 'Audio 1',
                        audioUrl: '',
                        imageUrl: '',
                        transcript: '',
                        model: '<p>Modelo do Audio 1.</p>',
                        problem: '<p>Escreva aqui o problem.</p>',
                        modelAnswer: '<p>Escreva aqui o model answer.</p>',
                        controllerQuestion: '',
                        controllerAnswer: ''
                    },
                    {
                        titulo: 'Audio 2',
                        audioUrl: '',
                        imageUrl: '',
                        transcript: '',
                        model: '<p>Modelo do Audio 2.</p>',
                        problem: '',
                        modelAnswer: '',
                        controllerQuestion: 'What did the controller say?',
                        controllerAnswer: '<p>Escreva aqui a resposta.</p>'
                    }
                ]
            };
            novoItem.conteudo = this.montarConteudoLegadoFase2(novoItem);
        } else if (fase === 'fase3') {
            novoItem = {
                idProva: prova.id,
                conteudo: [
                    { titulo: 'Nova situação 1', audioUrl: '', transcricao: '', model: '<p>Modelo de resposta.</p>', perguntaFinal: '', respostaFinal: '' },
                    { titulo: 'Nova situação 2', audioUrl: '', transcricao: '', model: '<p>Modelo de resposta.</p>', perguntaFinal: '', respostaFinal: '' },
                    { titulo: 'Nova situação 3', audioUrl: '', transcricao: '', model: '<p>Modelo de resposta.</p>', perguntaFinal: '', respostaFinal: '' }
                ],
                comparacaoCustomizada: {
                    perguntaHTML: '<p>Compare as situações apresentadas.</p>',
                    guiaAjudaHTML: '<p>Guia de ajuda.</p>',
                    modeloRespostaHTML: '<p>Modelo de resposta da comparação.</p>'
                }
            };
        } else if (fase === 'fase4') {
            novoItem = {
                idProva: prova.id,
                imageUrl: '',
                descricaoHtml: '<p>Descrição da imagem.</p>',
                perguntas: [
                    {
                        tipoPergunta: 'before',
                        perguntaTexto: 'What happened before this picture was taken?',
                        respostaTexto: '<p>Resposta esperada para o que aconteceu antes da foto.</p>'
                    },
                    {
                        tipoPergunta: 'next',
                        perguntaTexto: 'What will happen next?',
                        respostaTexto: '<p>Resposta esperada para o que acontecerá em seguida.</p>'
                    },
                    {
                        tipoPergunta: 'custom1',
                        perguntaTexto: 'Custom Question 1',
                        respostaTexto: '<p>Resposta esperada.</p>'
                    },
                    {
                        tipoPergunta: 'custom2',
                        perguntaTexto: 'Custom Question 2',
                        respostaTexto: '<p>Resposta esperada.</p>'
                    }
                ],
                statement: {
                    textoAfirmacao: '<p>Afirmação para discussão.</p>',
                    agreeTexto: '<p>Resposta para I agree.</p>',
                    disagreeTexto: '<p>Resposta para I disagree.</p>'
                }
            };
        }

        if (!novoItem) return;

        prova.fases[fase].push(novoItem);
        prova.updatedAt = new Date().toISOString();

        await this.salvarProvaPreviewNoFirebase(prova);

        const novoIndex = prova.fases[fase].length - 1;
        alert('Item cadastrado. Complete as informações na tela de edição.');
        await this.abrirItemBanco(fase, prova.id, novoIndex);
        this.renderizarProvas();
    },

    async abrirItemBanco(fase, provaId, index) {
        const prova = await this.carregarProvaPorId(provaId);

        if (!prova?.fases?.[fase]?.[index]) {
            alert('Item não encontrado para visualização/edição.');
            return;
        }

        this.estado.provaEmPreview = prova;
        this.estado.provaEmEdicaoId = prova.id;

        if (fase === 'fase1') this.abrirEditorFase1(index);
        else if (fase === 'fase2') this.abrirEditorFase2(index);
        else if (fase === 'fase3') this.abrirEditorFase3(index);
        else if (fase === 'fase4') this.abrirEditorFase4(index);
    },

    async duplicarItemBanco(fase, provaId, index) {
        const prova = await this.carregarProvaPorId(provaId);

        if (!prova?.fases?.[fase]?.[index]) {
            alert('Item não encontrado para duplicar.');
            return;
        }

        prova.fases[fase].splice(index + 1, 0, JSON.parse(JSON.stringify(prova.fases[fase][index])));
        prova.updatedAt = new Date().toISOString();

        await this.salvarProvaPreviewNoFirebase(prova);
        alert('Item duplicado com sucesso.');
        this.renderizarProvas();
    },

    async excluirItemBanco(fase, provaId, index) {
        const confirmar = confirm('Tem certeza que deseja excluir este item do banco de questões?');
        if (!confirmar) return;

        const prova = await this.carregarProvaPorId(provaId);

        if (!prova?.fases?.[fase]?.[index]) {
            alert('Item não encontrado para excluir.');
            return;
        }

        prova.fases[fase].splice(index, 1);
        prova.updatedAt = new Date().toISOString();

        await this.salvarProvaPreviewNoFirebase(prova);
        alert('Item excluído com sucesso.');
        this.renderizarProvas();
    },

    async excluirProva(id, titulo = '') {
        if (!id) return;

        const nome = titulo || id;

        const confirmar = confirm(
            `Tem certeza que deseja excluir a prova "${nome}"?\n\nEssa ação remove a prova do Firestore e não pode ser desfeita pelo painel.`
        );

        if (!confirmar) return;

        const confirmacaoTexto = prompt(
            `Para confirmar a exclusão definitiva, digite EXCLUIR`
        );

        if (confirmacaoTexto !== 'EXCLUIR') {
            alert('Exclusão cancelada.');
            return;
        }

        try {
            await deleteDoc(doc(db, 'provas', id));

            if (this.estado.provaEmEdicaoId === id || this.estado.provaEmPreview?.id === id) {
                this.fecharModalProva();
            }

            alert('Prova excluída com sucesso.');
            await this.renderizarProvas();

        } catch (erro) {
            console.error('Erro ao excluir prova:', erro);
            alert('Erro ao excluir prova. Verifique conexão e permissões do Firebase.');
        }
    },

    abrirModalProva(prova = null) {
        this.estado.provaEmEdicaoId = prova?.id || null;
        this.estado.provaEmPreview = null;

        document.getElementById('modal-prova').style.display = 'block';
        document.getElementById('modal-prova-titulo').innerText = prova ? 'Editar prova' : 'Criar nova prova';

        const form = document.getElementById('form-json-prova');
        const preview = document.getElementById('preview-prova-admin-container');
        if (form) form.style.display = 'block';
        if (preview) preview.innerHTML = '';

        document.getElementById('prova-titulo').value = prova?.titulo || '';
        document.getElementById('prova-ativa').checked = prova?.ativa !== false;

        const conteudo = prova ? { ...(prova.fases ? prova.fases : prova) } : {
            fase1: [],
            fase2: [],
            fase3: [],
            fase4: []
        };

        delete conteudo.id;
        delete conteudo.titulo;
        delete conteudo.ativa;
        delete conteudo.createdAt;
        delete conteudo.updatedAt;

        document.getElementById('prova-json').value = JSON.stringify(conteudo, null, 2);
    },

    fecharModalProva() {
        document.getElementById('modal-prova').style.display = 'none';
        this.estado.provaEmEdicaoId = null;
        this.estado.provaEmPreview = null;

        const form = document.getElementById('form-json-prova');
        const preview = document.getElementById('preview-prova-admin-container');
        if (form) form.style.display = 'block';
        if (preview) preview.innerHTML = '';
    },

    validarJsonProva() {
        try {
            const json = JSON.parse(document.getElementById('prova-json').value || '{}');
            const fases = json.fases || json;
            const ok = ['fase1', 'fase2', 'fase3', 'fase4'].every((fase) => Array.isArray(fases[fase]));
            if (!ok) throw new Error('O JSON precisa conter fase1, fase2, fase3 e fase4 como arrays.');
            alert('JSON válido.');
            return json;
        } catch (erro) {
            alert(`JSON inválido: ${erro.message}`);
            return null;
        }
    },

    async salvarProvaAtual() {
        const json = this.validarJsonProva();
        if (!json) return;

        const titulo = document.getElementById('prova-titulo').value.trim() || 'Prova sem título';
        const ativa = document.getElementById('prova-ativa').checked;
        const payload = {
            titulo,
            ativa,
            fases: json.fases || json,
            updatedAt: new Date().toISOString()
        };

        try {
            if (this.estado.provaEmEdicaoId) {
                await setDoc(doc(db, 'provas', this.estado.provaEmEdicaoId), payload, { merge: true });
            } else {
                payload.createdAt = new Date().toISOString();
                await addDoc(collection(db, 'provas'), payload);
            }

            alert('Prova salva com sucesso. Os alunos receberão a atualização no próximo login/sync online.');
            this.fecharModalProva();
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao salvar prova:', erro);
            alert('Erro ao salvar prova. Verifique conexão e permissões do Firebase.');
        }
    },

    async carregarProvaParaEdicao(id) {
        const snapshot = await getDocs(collection(db, 'provas'));
        let encontrada = null;
        snapshot.forEach((docSnap) => {
            if (docSnap.id === id) encontrada = { id: docSnap.id, ...docSnap.data() };
        });

        if (!encontrada) {
            alert('Prova não encontrada.');
            return;
        }

        this.abrirPreviewVisual(encontrada);
    },

    async migrarPerguntasLocalParaFirebase() {
        alert('A migração via perguntas.js foi removida. O banco de questões agora deve ser gerenciado diretamente pelo Firestore/Admin.');
    },

    abrirPreviewVisual(prova) {
        this.estado.provaEmEdicaoId = prova?.id || null;
        this.estado.provaEmPreview = prova;

        const modal = document.getElementById('modal-prova');
        const form = document.getElementById('form-json-prova');
        const preview = document.getElementById('preview-prova-admin-container');

        modal.style.display = 'block';
        document.getElementById('modal-prova-titulo').innerText =
            `CMS Visual - ${prova.titulo || prova.id}`;

        if (form) form.style.display = 'none';
        if (!preview) return;

        const fases = prova.fases || {
            fase1: [],
            fase2: [],
            fase3: [],
            fase4: []
        };

        preview.innerHTML = `
            <div style="background:#f8fafc;color:#0f172a;border-radius:14px;padding:16px;">
                ${this.renderizarCabecalhoCMS(prova)}
                ${this.renderizarFase1CMS(fases.fase1 || [])}
                ${this.renderizarFase2CMS(fases.fase2 || [])}
                ${this.renderizarFase3CMS(fases.fase3 || [])}
                ${this.renderizarFase4CMS(fases.fase4 || [])}

            </div>
        `;

        preview.querySelectorAll('.btn-cms-editar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const fase = btn.dataset.fase;
                const index = parseInt(btn.dataset.index, 10);

                if (fase === 'fase1') this.abrirEditorFase1(index);
                else if (fase === 'fase2') this.abrirEditorFase2(index);
                else if (fase === 'fase3') this.abrirEditorFase3(index);
                else if (fase === 'fase4') this.abrirEditorFase4(index);
            });
        });

        preview.querySelectorAll('.btn-cms-adicionar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const fase = btn.dataset.fase;
                if (fase === 'fase1') this.adicionarQuestaoFase1();
                else if (fase === 'fase2') this.adicionarInteracaoFase2();
                else if (fase === 'fase3') this.adicionarBlocoFase3();
                else if (fase === 'fase4') this.adicionarPhotoFase4();
            });
        });

        preview.querySelectorAll('.btn-cms-duplicar').forEach((btn) => {
            btn.addEventListener('click', () => this.duplicarItemFase(btn.dataset.fase, parseInt(btn.dataset.index, 10)));
        });

        preview.querySelectorAll('.btn-cms-excluir').forEach((btn) => {
            btn.addEventListener('click', () => this.excluirItemFase(btn.dataset.fase, parseInt(btn.dataset.index, 10)));
        });

        preview.querySelectorAll('.btn-cms-adicionar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const fase = btn.dataset.fase;

                if (fase === 'fase1') {
                    this.adicionarQuestaoFase1();
                } else if (fase === 'fase2') {
                    this.adicionarInteracaoFase2();
                }
            });
        });
    },

    renderizarCabecalhoCMS(prova) {
        const fases = prova.fases || {};
        const totalFase1 = (fases.fase1 || []).length;
        const totalFase2 = (fases.fase2 || []).length;
        const totalFase3 = (fases.fase3 || []).length;
        const totalFase4 = (fases.fase4 || []).length;

        return `
            <div style="background:#0f172a;color:#fff;border-radius:12px;padding:16px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div>
                        <h2 style="margin:0 0 6px 0;font-size:20px;color:#fff;">${prova.titulo || prova.id}</h2>
                        <div style="font-size:12px;color:#94a3b8;">ID: ${prova.id}</div>
                    </div>
                    <div>
                        ${prova.ativa === false ? pill('Inativa', '#fee2e2', '#991b1b') : pill('Ativa', '#dcfce7', '#166534')}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;">
                    <div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:10px;text-align:center;">
                        <div style="font-size:18px;font-weight:800;">${totalFase1}</div>
                        <div style="font-size:11px;color:#94a3b8;">Fase 1</div>
                    </div>
                    <div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:10px;text-align:center;">
                        <div style="font-size:18px;font-weight:800;">${totalFase2}</div>
                        <div style="font-size:11px;color:#94a3b8;">Fase 2</div>
                    </div>
                    <div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:10px;text-align:center;">
                        <div style="font-size:18px;font-weight:800;">${totalFase3}</div>
                        <div style="font-size:11px;color:#94a3b8;">Fase 3</div>
                    </div>
                    <div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:10px;text-align:center;">
                        <div style="font-size:18px;font-weight:800;">${totalFase4}</div>
                        <div style="font-size:11px;color:#94a3b8;">Fase 4</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderizarSecaoCMS(titulo, subtitulo, conteudo, acaoAdicionar = '') {
        return `
            <section style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div>
                        <h3 style="margin:0;color:#0f172a;font-size:17px;">${titulo}</h3>
                        <p style="margin:4px 0 0 0;color:#64748b;font-size:12px;line-height:1.4;">${subtitulo}</p>
                    </div>
                    ${acaoAdicionar || `
                        <button disabled style="background:#e2e8f0;color:#64748b;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;">
                            + Adicionar
                        </button>
                    `}
                </div>
                <div style="display:grid;gap:12px;">${conteudo}</div>
            </section>
        `;
    },

    renderizarCardBase(titulo, badges, corpo, meta = {}) {
        return `
            <article style="border:1px solid #e2e8f0;border-radius:12px;padding:13px;background:#ffffff;box-shadow:0 1px 3px rgba(15,23,42,.05);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
                    <div>
                        <h4 style="margin:0 0 7px 0;color:#0f172a;font-size:15px;line-height:1.3;">${titulo}</h4>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">${badges || ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                        <button class="btn-cms-editar"
                                data-fase="${meta.fase || ''}"
                                data-index="${meta.index ?? ''}"
                                style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            ✏ Editar
                        </button>
                        <button class="btn-cms-duplicar"
                                data-fase="${meta.fase || ''}"
                                data-index="${meta.index ?? ''}"
                                style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            ⧉ Duplicar
                        </button>
                        <button class="btn-cms-excluir"
                                data-fase="${meta.fase || ''}"
                                data-index="${meta.index ?? ''}"
                                style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
                            🗑 Excluir
                        </button>
                    </div>
                </div>
                ${corpo}
            </article>
        `;
    },

    renderizarFase1CMS(lista = []) {
        const conteudo = lista.length
            ? lista.map((item, index) => {
                const corpo = `
                    ${blocoInfo('Pergunta', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${htmlConteudo(item.tituloContexto)}</div>`)}
                    ${blocoInfo('Modelo de resposta', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${htmlConteudo(item.modeloResposta)}</div>`)}
                `;

                return this.renderizarCardBase(
                    `Questão ${index + 1}`,
                    `${pill('Aviation Topics')} ${pill(item.idProva || 'sem id', '#f1f5f9', '#475569')}`,
                    corpo,
                    { fase: 'fase1', index }
                );
            }).join('')
            : '<p style="color:#94a3b8;font-size:13px;">Nenhuma questão cadastrada na Fase 1.</p>';

        return this.renderizarSecaoCMS(
            'Fase 1 — Aviation Topics',
            'Perguntas abertas de rotina, experiência e preparação do piloto.',
            conteudo,
            `
                <button class="btn-cms-adicionar" data-fase="fase1" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;">
                    + Adicionar questão
                </button>
            `
        );
    },


    normalizarInteracaoFase2(item = {}, index = 0) {
        const conteudo = Array.isArray(item.conteudo) ? item.conteudo : [];
        const audiosOriginais = Array.isArray(item.audios) ? item.audios : [];

        const scenario = item.scenario || item.cenario || item.tituloContexto || conteudo?.[0]?.titulo || '';

        const audios = audiosOriginais.length
            ? audiosOriginais.map((audio, audioIndex) => ({
                titulo: audio.titulo || audio.label || `Audio ${audioIndex + 1}`,
                audioUrl: audio.audioUrl || '',
                imageUrl: audio.imageUrl || '',
                transcript: audio.transcript || audio.transcricao || '',
                model: audio.model || '',
                problem: audio.problem || '',
                modelAnswer: audio.modelAnswer || audio.respostaModelo || '',
                controllerQuestion: audio.controllerQuestion || audio.whatDidControllerSay || audio.perguntaController || '',
                controllerAnswer: audio.controllerAnswer || audio.respostaController || audio.whatDidControllerAnswer || ''
            }))
            : conteudo
                .filter((bloco, blocoIndex) => !(blocoIndex === 0 && bloco.tipo === 'bloco-texto'))
                .map((bloco, blocoIndex) => ({
                    titulo: bloco.tituloAudio || bloco.label || `Audio ${blocoIndex + 1}`,
                    audioUrl: bloco.audioUrl || '',
                    imageUrl: bloco.imageUrl || '',
                    transcript: bloco.transcript || bloco.transcricao || '',
                    model: bloco.model || '',
                    problem: bloco.problem || bloco.perguntaFinal || '',
                    modelAnswer: bloco.modelAnswer || bloco.respostaModelo || bloco.respostaFinal || '',
                    controllerQuestion: bloco.controllerQuestion || bloco.whatDidControllerSay || '',
                    controllerAnswer: bloco.controllerAnswer || bloco.respostaController || bloco.whatDidControllerAnswer || ''
                }));

        return {
            ...item,
            idProva: item.idProva || this.estado.provaEmPreview?.id || '',
            interacao: Number(item.interacao || index + 1),
            blocoLinear: item.blocoLinear !== false,
            scenario,
            audios
        };
    },

    montarConteudoLegadoFase2(interacaoNormalizada = {}) {
        const audios = Array.isArray(interacaoNormalizada.audios) ? interacaoNormalizada.audios : [];
        const conteudo = [];

        if (interacaoNormalizada.scenario) {
            conteudo.push({
                tipo: 'bloco-texto',
                titulo: interacaoNormalizada.scenario
            });
        }

        audios.forEach((audio, audioIndex) => {
            conteudo.push({
                tipo: audio.problem ? 'bloco-audio-pergunta' : 'bloco-audio',
                titulo: audio.problem || audio.titulo || `Audio ${audioIndex + 1}`,
                tituloAudio: audio.titulo || `Audio ${audioIndex + 1}`,
                audioUrl: audio.audioUrl || '',
                imageUrl: audio.imageUrl || '',
                transcricao: audio.transcript || '',
                model: audio.model || '',
                problem: audio.problem || '',
                modelAnswer: audio.modelAnswer || '',
                perguntaFinal: audio.controllerQuestion || '',
                respostaFinal: audio.controllerAnswer || ''
            });
        });

        return conteudo;
    },

    renderizarFase2CMS(lista = []) {
        const ordenada = [...lista].sort((a, b) => Number(a.interacao || 0) - Number(b.interacao || 0));

        const conteudo = ordenada.length
            ? ordenada.map((itemOriginal, index) => {
                const item = this.normalizarInteracaoFase2(itemOriginal, index);
                const audiosLista = item.audios || [];
                const audio1 = audiosLista[0] || {};
                const audio2 = audiosLista[1] || {};
                const audioProblem = audiosLista.find((audio) => audio.problem || audio.modelAnswer || audio.imageUrl) || audio1;
                const controllerFonte = [...audiosLista].reverse().find((audio) => audio.controllerQuestion || audio.controllerAnswer) || {};
                const interacaoNumero = Number(item.interacao || index + 1);
                const permiteImagem = [4, 5].includes(interacaoNumero);

                const corpo = `
                    <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">
                        ${pill(`Interaction ${interacaoNumero}`, permiteImagem ? '#fef3c7' : '#e0f2fe', permiteImagem ? '#92400e' : '#0369a1')}
                        ${item.blocoLinear ? pill('Bloco linear', '#dcfce7', '#166534') : ''}
                        ${permiteImagem ? pill('Problem com imagem permitido', '#fef3c7', '#92400e') : pill('Sem imagem no problem', '#f1f5f9', '#475569')}
                    </div>

                    ${blocoInfo('1. Scenario', `<div class="conteudo-formatado-admin" style="font-weight:700;line-height:1.5;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(item.scenario)}</div>`)}

                    <div style="border-left:3px solid #0ea5e9;padding-left:10px;margin:14px 0;">
                        <div style="margin-bottom:8px;">${pill('2. Audio 1', '#e0f2fe', '#0369a1')}</div>
                        ${audio1.audioUrl ? blocoInfo('Audio 1', midiaPath(audio1.audioUrl)) : blocoInfo('Audio 1', '<span style="color:#94a3b8;font-style:italic;">Sem áudio</span>')}
                        ${audio1.transcript ? blocoInfo('3. Transcript 1', `<div style="font-family:ui-monospace,monospace;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${escaparHTML(audio1.transcript)}</div>`) : ''}
                        ${audio1.model ? blocoInfo('4. Model 1', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(audio1.model)}</div>`) : ''}
                    </div>

                    ${permiteImagem && audioProblem.imageUrl ? blocoInfo('5. Problem Image', `${midiaPath(audioProblem.imageUrl)}<div style="margin-top:8px;text-align:center;"><img src="${audioProblem.imageUrl}" alt="Preview" style="max-width:100%;max-height:180px;border-radius:10px;border:1px solid #e2e8f0;object-fit:contain;"></div>`) : ''}

                    ${audioProblem.problem ? blocoInfo(permiteImagem ? '6. Problem' : '5. Problem', `<div style="font-weight:700;text-align:center;line-height:1.5;">${htmlConteudo(audioProblem.problem)}</div>`) : ''}

                    ${audioProblem.modelAnswer ? blocoInfo(permiteImagem ? '7. Model Answer / Request Model' : '6. Model Answer / Request Model', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(audioProblem.modelAnswer)}</div>`) : ''}

                    <div style="border-left:3px solid #0ea5e9;padding-left:10px;margin:14px 0;">
                        <div style="margin-bottom:8px;">${pill(permiteImagem ? '8. Audio 2' : '7. Audio 2', '#e0f2fe', '#0369a1')}</div>
                        ${audio2.audioUrl ? blocoInfo('Audio 2', midiaPath(audio2.audioUrl)) : blocoInfo('Audio 2', '<span style="color:#94a3b8;font-style:italic;">Sem áudio</span>')}
                        ${audio2.transcript ? blocoInfo(permiteImagem ? '9. Transcript 2' : '8. Transcript 2', `<div style="font-family:ui-monospace,monospace;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${escaparHTML(audio2.transcript)}</div>`) : ''}
                        ${audio2.model ? blocoInfo(permiteImagem ? '10. Model 2' : '9. Model 2', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(audio2.model)}</div>`) : ''}
                    </div>

                    ${controllerFonte.controllerQuestion || controllerFonte.controllerAnswer ? blocoInfo(permiteImagem ? '11. What did the controller say?' : '10. What did the controller say?', `${controllerFonte.controllerQuestion ? escaparHTML(controllerFonte.controllerQuestion) : ''}${controllerFonte.controllerAnswer ? `<div style="margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(controllerFonte.controllerAnswer)}</div>` : ''}`) : ''}
                `;

                return this.renderizarCardBase(
                    `Interaction ${item.interacao || index + 1}`,
                    `${pill(item.idProva || 'sem id', '#f1f5f9', '#475569')} ${pill(`${(item.audios || []).length} áudio(s)`, '#e0f2fe', '#0369a1')}`,
                    corpo,
                    { fase: 'fase2', index }
                );
            }).join('')
            : '<p style="color:#94a3b8;font-size:13px;">Nenhuma interação cadastrada na Fase 2.</p>';

        return this.renderizarSecaoCMS(
            'Fase 2 — Interacting as a Pilot',
            'Sequência oficial: Interaction → Scenario → Audio 1 → Transcript 1 → Model 1 → Problem → Model Answer → Audio 2 → Transcript 2 → Model 2 → What did the controller say? (opcional). Nas interações 4 e 5, a imagem aparece no bloco Problem.',
            conteudo,
            `
                <button class="btn-cms-adicionar" data-fase="fase2" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;">
                    + Adicionar interação
                </button>
            `
        );
    },
    renderizarFase3CMS(lista = []) {
        const conteudo = lista.length
            ? lista.map((item, index) => {
                const situacoes = (item.conteudo || []).map((sit, sitIndex) => `
                    <div style="border-left:3px solid #f97316;padding-left:10px;margin-bottom:12px;">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                            ${pill(`Situation ${sitIndex + 1}`, '#ffedd5', '#9a3412')}
                            ${sit.audioUrl ? pill('Áudio', '#dcfce7', '#166534') : ''}
                            ${sit.perguntaFinal ? pill('Pergunta final', '#ede9fe', '#5b21b6') : ''}
                        </div>
                        ${blocoInfo('Título', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(sit.titulo)}</div>`)}
                        ${sit.audioUrl ? blocoInfo('Arquivo de áudio', midiaPath(sit.audioUrl)) : ''}
                        ${sit.transcricao ? blocoInfo('Transcrição', `<div class="conteudo-formatado-admin" style="font-family:ui-monospace,monospace;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(sit.transcricao)}</div>`) : ''}
                        ${sit.model ? blocoInfo('Modelo', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(sit.model)}</div>`) : ''}
                        ${sit.perguntaFinal ? blocoInfo('Pergunta final', escaparHTML(sit.perguntaFinal)) : ''}
                        ${sit.respostaFinal ? blocoInfo('Resposta final', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(sit.respostaFinal)}</div>`) : ''}
                    </div>
                `).join('');

                const comp = item.comparacaoCustomizada;
                const comparacao = comp ? `
                    <div style="border-left:3px solid #7c3aed;padding-left:10px;margin-top:12px;">
                        <div style="margin-bottom:8px;">${pill('Comparison', '#ede9fe', '#5b21b6')}</div>
                        ${blocoInfo('Pergunta de comparação', htmlConteudo(comp.perguntaHTML))}
                        ${blocoInfo('Guia de ajuda', `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(comp.guiaAjudaHTML)}</div>`)}
                        ${blocoInfo('Modelo de resposta', `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(comp.modeloRespostaHTML)}</div>`)}
                    </div>
                ` : '<p style="color:#94a3b8;font-size:13px;">Sem comparação cadastrada.</p>';

                return this.renderizarCardBase(
                    `Bloco de situações ${index + 1}`,
                    `${pill(item.idProva || 'sem id', '#f1f5f9', '#475569')} ${pill(`${(item.conteudo || []).length} situações`, '#ffedd5', '#9a3412')}`,
                    `${situacoes}${comparacao}`,
                    { fase: 'fase3', index }
                );
            }).join('')
            : '<p style="color:#94a3b8;font-size:13px;">Nenhum bloco cadastrado na Fase 3.</p>';

        return this.renderizarSecaoCMS(
            'Fase 3 — Unexpected Situations',
            'Bloco com três comunicações e uma comparação final.',
            conteudo,
            `
                <button class="btn-cms-adicionar" data-fase="fase3" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;">
                    + Adicionar bloco
                </button>
            `
        );
    },

    obterTipoPerguntaFase4(pIndex, pergunta = {}) {
        if (pergunta?.tipoPergunta) return pergunta.tipoPergunta;

        const texto = String(pergunta?.perguntaTexto || '').trim().toLowerCase();

        if (texto === 'what happened before this picture was taken?') return 'before';
        if (texto === 'what will happen next?') return 'next';

        if (pIndex === 0) return 'before';
        if (pIndex === 1) return 'next';
        if (pIndex === 2) return 'custom1';
        if (pIndex === 3) return 'custom2';

        return `custom${pIndex - 1}`;
    },

    obterLabelPerguntaFase4(pIndex, pergunta = {}) {
        const tipo = this.obterTipoPerguntaFase4(pIndex, pergunta);

        const mapa = {
            before: {
                titulo: 'Pergunta 1 — Before',
                badge: 'Before',
                fixa: true,
                textoPadrao: 'What happened before this picture was taken?'
            },
            next: {
                titulo: 'Pergunta 2 — Next',
                badge: 'Next',
                fixa: true,
                textoPadrao: 'What will happen next?'
            },
            custom1: {
                titulo: 'Pergunta 3 — Customizada 1',
                badge: 'Custom 1',
                fixa: false,
                textoPadrao: pergunta?.perguntaTexto || 'Custom Question 1'
            },
            custom2: {
                titulo: 'Pergunta 4 — Customizada 2',
                badge: 'Custom 2',
                fixa: false,
                textoPadrao: pergunta?.perguntaTexto || 'Custom Question 2'
            }
        };

        return mapa[tipo] || {
            titulo: `Pergunta ${pIndex + 1} — Customizada`,
            badge: `Custom ${pIndex + 1}`,
            fixa: false,
            textoPadrao: pergunta?.perguntaTexto || ''
        };
    },

    normalizarPerguntasFase4(perguntas = []) {
        const base = Array.isArray(perguntas) ? perguntas : [];

        const normalizadas = [0, 1, 2, 3].map((idx) => {
            const existente = base[idx] || {};
            const meta = this.obterLabelPerguntaFase4(idx, existente);

            return {
                ...existente,
                tipoPergunta: this.obterTipoPerguntaFase4(idx, existente),
                perguntaTexto: meta.fixa ? meta.textoPadrao : (existente.perguntaTexto || meta.textoPadrao),
                respostaTexto: existente.respostaTexto || '<p>Resposta esperada.</p>'
            };
        });

        base.slice(4).forEach((extra, extraIndex) => {
            normalizadas.push({
                ...extra,
                tipoPergunta: extra.tipoPergunta || `custom${extraIndex + 3}`,
                perguntaTexto: extra.perguntaTexto || `Custom Question ${extraIndex + 3}`,
                respostaTexto: extra.respostaTexto || '<p>Resposta esperada.</p>'
            });
        });

        return normalizadas;
    },

    renderizarFase4CMS(lista = []) {
        const conteudo = lista.length
            ? lista.map((item, index) => {
                const perguntasNormalizadas = this.normalizarPerguntasFase4(item.perguntas || []);
                const perguntas = perguntasNormalizadas.map((p, pIndex) => {
                    const metaPergunta = this.obterLabelPerguntaFase4(pIndex, p);
                    const corBorda = metaPergunta.fixa ? '#0ea5e9' : '#64748b';
                    const badge = metaPergunta.fixa
                        ? pill(metaPergunta.badge, '#e0f2fe', '#0369a1')
                        : pill(metaPergunta.badge, '#f1f5f9', '#475569');

                    return `
                        <div style="border-left:3px solid ${corBorda};padding-left:10px;margin-bottom:10px;">
                            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                                ${pill(metaPergunta.titulo, metaPergunta.fixa ? '#dbeafe' : '#f1f5f9', metaPergunta.fixa ? '#1d4ed8' : '#475569')}
                                ${badge}
                                ${metaPergunta.fixa ? pill('Pergunta fixa', '#dcfce7', '#166534') : pill('Editável', '#fef3c7', '#92400e')}
                            </div>
                            ${blocoInfo('Pergunta', escaparHTML(resumoRichText(p.perguntaTexto, 180, '-')), 'margin-top:8px;')}
                            ${blocoInfo('Resposta', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(p.respostaTexto)}</div>`)}
                        </div>
                    `;
                }).join('');

                const statement = item.statement ? `
                    <div style="border-left:3px solid #0f172a;padding-left:10px;margin-top:12px;">
                        <div style="margin-bottom:8px;">${pill('Statement', '#e2e8f0', '#0f172a')}</div>
                        ${blocoInfo('Afirmação', htmlConteudo(item.statement.textoAfirmacao))}
                        ${blocoInfo('I Agree', `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px;">${htmlConteudo(item.statement.agreeTexto)}</div>`)}
                        ${blocoInfo('I Disagree', `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px;">${htmlConteudo(item.statement.disagreeTexto)}</div>`)}
                    </div>
                ` : '<p style="color:#94a3b8;font-size:13px;">Sem statement cadastrado.</p>';

                const corpo = `
                    ${item.imageUrl ? blocoInfo('Imagem principal', `
                        ${midiaPath(item.imageUrl)}
                        <div style="margin-top:10px;text-align:center;">
                            <img src="${item.imageUrl}" alt="Preview fase 4" style="max-width:100%;max-height:220px;border-radius:12px;border:1px solid #e2e8f0;object-fit:contain;">
                        </div>
                    `) : ''}
                    ${blocoInfo('Descrição', `<div class="conteudo-formatado-admin" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;">${htmlConteudo(item.descricaoHtml)}</div>`)}
                    <div style="margin-top:12px;margin-bottom:8px;font-size:13px;font-weight:800;color:#0f172a;">Perguntas da imagem</div>
                    ${perguntas || '<p style="color:#94a3b8;font-size:13px;">Sem perguntas cadastradas.</p>'}
                    ${statement}
                `;

                return this.renderizarCardBase(
                    `Photo ${index + 1}`,
                    `${pill(item.idProva || 'sem id', '#f1f5f9', '#475569')} ${pill('Visual Analysis', '#e0f2fe', '#0369a1')}`,
                    corpo,
                    { fase: 'fase4', index }
                );
            }).join('')
            : '<p style="color:#94a3b8;font-size:13px;">Nenhuma imagem cadastrada na Fase 4.</p>';

        return this.renderizarSecaoCMS(
            'Fase 4 — Visual & Meteorological Analysis',
            'Descrição de imagem, perguntas operacionais e statement.',
            conteudo,
            `
                <button class="btn-cms-adicionar" data-fase="fase4" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;">
                    + Adicionar photo
                </button>
            `
        );
    },

    normalizarRichText(html = '') {
        /*
            Preserva a formatação visual digitada pelo usuário no editor:
            - parágrafos;
            - linhas em branco geradas por Enter/Enter;
            - listas;
            - bold/italic/underline;
            - spans de tamanho de fonte;
            - espaçamento entre blocos.

            O ponto principal é NÃO remover <p><br></p>, <div><br></div>
            ou linhas vazias, pois elas representam o espaço intencional
            entre parágrafos no simulado.
        */
        let conteudo = String(html || '').trim();

        if (!conteudo) return '';

        conteudo = conteudo
            // Normaliza wrappers comuns do contenteditable.
            .replace(/<div><br><\/div>/gi, '<p><br></p>')
            .replace(/<div>\s*<\/div>/gi, '<p><br></p>')
            .replace(/<div>/gi, '<p>')
            .replace(/<\/div>/gi, '</p>')

            // Normaliza spans vazios e nbsp gerados pelo navegador.
            .replace(/&nbsp;/gi, ' ')

            // Garante que parágrafos vazios continuem ocupando espaço.
            .replace(/<p>\s*<\/p>/gi, '<p><br></p>')

            // Remove excesso de espaços entre tags sem destruir parágrafos.
            .replace(/>\s+</g, '><')

            .trim();

        return conteudo;
    },

    criarToolbarRichText(editorId) {
        return `
            <div class="richtext-toolbar" data-editor="${editorId}" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#f8fafc;border:1px solid #cbd5e1;border-bottom:none;border-radius:10px 10px 0 0;padding:8px;">
                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="bold" title="Negrito" style="font-weight:900;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;cursor:pointer;">B</button>
                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="italic" title="Itálico" style="font-style:italic;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;cursor:pointer;">I</button>
                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="underline" title="Sublinhado" style="text-decoration:underline;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;cursor:pointer;">U</button>
                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="insertUnorderedList" title="Lista com tópicos" style="background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;cursor:pointer;">• Lista</button>
                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="insertOrderedList" title="Lista numerada" style="background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 10px;cursor:pointer;">1. Lista</button>

                <select class="select-richtext-fontsize" data-editor="${editorId}" title="Tamanho da fonte atual" style="background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:7px 9px;cursor:pointer;color:#0f172a;font-weight:700;">
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                </select>

                <button type="button" class="btn-richtext" data-editor="${editorId}" data-command="removeFormat" title="Limpar formatação" style="background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:7px;padding:7px 10px;cursor:pointer;">🧹 Limpar</button>
            </div>
        `;
    },

    obterEditorDaSelecao(editor) {
        const selection = window.getSelection?.();
        if (!selection || !selection.rangeCount) return editor;

        let node = selection.anchorNode;
        if (!node) return editor;

        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        if (!node || !editor.contains(node)) return editor;

        return node;
    },

    obterFontSizeAtual(editor) {
        const alvo = this.obterEditorDaSelecao(editor);
        const computed = window.getComputedStyle(alvo || editor);
        const tamanho = computed?.fontSize || '14px';
        const numero = Math.round(parseFloat(tamanho) || 14);
        const opcoes = [12, 14, 16, 18, 20, 24, 28];
        const maisProxima = opcoes.reduce((melhor, atual) => {
            return Math.abs(atual - numero) < Math.abs(melhor - numero) ? atual : melhor;
        }, 14);

        return `${maisProxima}px`;
    },

    atualizarEstadoToolbarRichText(editorId) {
        const editor = document.getElementById(editorId);
        if (!editor) return;

        const toolbar = document.querySelector(`.richtext-toolbar[data-editor="${editorId}"]`);
        if (!toolbar) return;

        const comandos = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];

        comandos.forEach((command) => {
            const btn = toolbar.querySelector(`.btn-richtext[data-command="${command}"]`);
            if (!btn) return;

            let ativo = false;
            try {
                ativo = document.queryCommandState(command);
            } catch {
                ativo = false;
            }

            btn.classList.toggle('is-active', Boolean(ativo));
            btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
        });

        const select = toolbar.querySelector('.select-richtext-fontsize');
        if (select) {
            const tamanho = this.obterFontSizeAtual(editor);
            select.value = tamanho;
            select.title = `Tamanho da fonte atual: ${tamanho}`;
        }
    },

    ativarToolbarsRichText(container = document) {
        const atualizarDepois = (editorId) => {
            setTimeout(() => this.atualizarEstadoToolbarRichText(editorId), 0);
        };

        container.querySelectorAll('.btn-richtext').forEach((btn) => {
            btn.onclick = (event) => {
                event.preventDefault();

                const editorId = btn.dataset.editor;
                const command = btn.dataset.command;
                const editor = document.getElementById(editorId);

                if (!editor) return;

                editor.focus();

                if (command === 'removeFormat') {
                    document.execCommand('removeFormat', false, null);
                    document.execCommand('unlink', false, null);
                    atualizarDepois(editorId);
                    return;
                }

                document.execCommand(command, false, null);
                atualizarDepois(editorId);
            };
        });

        container.querySelectorAll('.select-richtext-fontsize').forEach((select) => {
            const editorId = select.dataset.editor;
            const editor = document.getElementById(editorId);

            if (editor) {
                const inicial = this.obterFontSizeAtual(editor);
                select.value = inicial;
                select.title = `Tamanho da fonte atual: ${inicial}`;
            }

            select.onchange = (event) => {
                const editorId = select.dataset.editor;
                const editor = document.getElementById(editorId);
                const size = event.target.value || '14px';

                if (!editor || !size) return;

                editor.focus();

                /*
                    Usa fontSize nativo para envolver a seleção e depois converte
                    <font size="7"> para <span style="font-size:XXpx">.
                    Isso mantém compatibilidade ampla com navegadores.
                */
                document.execCommand('fontSize', false, '7');

                editor.querySelectorAll('font[size="7"]').forEach((font) => {
                    const span = document.createElement('span');
                    span.style.fontSize = size;
                    span.innerHTML = font.innerHTML;
                    font.replaceWith(span);
                });

                select.value = size;
                select.title = `Tamanho da fonte atual: ${size}`;
                atualizarDepois(editorId);
            };
        });

        container.querySelectorAll('.campo-richtext-admin').forEach((editor) => {
            const atualizar = () => this.atualizarEstadoToolbarRichText(editor.id);

            editor.addEventListener('keyup', atualizar);
            editor.addEventListener('mouseup', atualizar);
            editor.addEventListener('focus', atualizar);
            editor.addEventListener('input', atualizar);

            setTimeout(atualizar, 0);
        });

        if (!this._richTextSelectionListenerAtivo) {
            this._richTextSelectionListenerAtivo = true;
            document.addEventListener('selectionchange', () => {
                const ativo = document.activeElement;
                if (ativo?.classList?.contains('campo-richtext-admin')) {
                    this.atualizarEstadoToolbarRichText(ativo.id);
                }
            });
        }
    },

    criarCampoRichText({ id, valor = '', minHeight = 180 }) {
        return `
            ${this.criarToolbarRichText(id)}
            <div id="${id}" contenteditable="true"
                class="campo-richtext-admin"
                style="
                    width:100%;
                    min-height:${minHeight}px;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #cbd5e1;
                    border-radius:0 0 10px 10px;
                    font-family:'Segoe UI', sans-serif;
                    font-size:14px;
                    line-height:1.6;
                    background:#fff;
                    color:#0f172a;
                    outline:none;
                    overflow:auto;
                    margin-bottom:14px;
                "
            >${valor || ''}</div>
        `;
    },

    criarCampoRichTextPlain({ id, valor = '', minHeight = 120, placeholder = '' }) {
        /*
            Editor rich text para substituir textareas comuns.
            Mantém aparência de textarea, mas permite formatação.
        */
        return `
            ${this.criarToolbarRichText(id)}
            <div id="${id}" contenteditable="true"
                class="campo-richtext-admin"
                data-placeholder="${escaparHTML(placeholder)}"
                style="
                    width:100%;
                    min-height:${minHeight}px;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #cbd5e1;
                    border-radius:0 0 10px 10px;
                    font-family:'Segoe UI', sans-serif;
                    font-size:14px;
                    line-height:1.6;
                    background:#fff;
                    color:#0f172a;
                    outline:none;
                    overflow:auto;
                    margin-bottom:14px;
                "
            >${valor || ''}</div>
        `;
    },

    abrirEditorFase1(index) {
        const prova = this.estado.provaEmPreview;

        if (!prova || !prova.fases || !Array.isArray(prova.fases.fase1)) {
            alert('Não foi possível carregar esta questão para edição.');
            return;
        }

        const item = prova.fases.fase1[index];

        if (!item) {
            alert('Questão não encontrada.');
            return;
        }

        document.getElementById('editor-fase1-modal')?.remove();

        const html = `
            <div id="editor-fase1-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;">
                <div style="width:100%;max-width:760px;max-height:90vh;overflow:auto;background:#ffffff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.35);box-sizing:border-box;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
                        <div>
                            <h2 style="margin:0;font-size:20px;color:#0f172a;">Editar Questão — Fase 1</h2>
                            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Questão ${index + 1} de ${prova.titulo || prova.id}</p>
                        </div>
                        <button id="btn-fechar-editor-fase1" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;">Fechar</button>
                    </div>

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pergunta</label>
                    ${this.criarCampoRichTextPlain({ id: 'edit-fase1-pergunta', valor: item.tituloContexto || '', minHeight: 120, placeholder: 'Digite a pergunta da Fase 1' })}

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Modelo de Resposta</label>
                    ${this.criarCampoRichText({ id: 'edit-fase1-modelo', valor: item.modeloResposta || '', minHeight: 240 })}

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">ID da Prova</label>
                    <input id="edit-fase1-idprova" value="${item.idProva || ''}" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;margin-bottom:18px;">

                    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
                        <button id="btn-cancelar-edicao-fase1" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:800;">Cancelar</button>
                        <button id="btn-salvar-edicao-fase1" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800;">Salvar alteração</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.ativarToolbarsRichText(document.getElementById('editor-fase1-modal'));

        const fechar = () => document.getElementById('editor-fase1-modal')?.remove();

        document.getElementById('btn-fechar-editor-fase1').onclick = fechar;
        document.getElementById('btn-cancelar-edicao-fase1').onclick = fechar;
        document.getElementById('btn-salvar-edicao-fase1').onclick = () => this.salvarEdicaoFase1(index);
    },

    async salvarEdicaoFase1(index) {
        const prova = this.estado.provaEmPreview;

        if (!prova || !prova.fases || !Array.isArray(prova.fases.fase1)) {
            alert('Não foi possível salvar. A prova não está carregada corretamente.');
            return;
        }

        const item = prova.fases.fase1[index];

        if (!item) {
            alert('Questão não encontrada para salvar.');
            return;
        }

        const pergunta = this.normalizarRichText(document.getElementById('edit-fase1-pergunta')?.innerHTML || '');
        const modelo = this.normalizarRichText(document.getElementById('edit-fase1-modelo')?.innerHTML || '');
        const idProva = document.getElementById('edit-fase1-idprova')?.value?.trim() || prova.id;

        if (!String(pergunta).replace(/<[^>]*>/g, '').trim()) {
            alert('A pergunta não pode ficar vazia.');
            return;
        }

        item.tituloContexto = pergunta;
        item.modeloResposta = modelo;
        item.idProva = idProva;
        prova.updatedAt = new Date().toISOString();

        try {
            await this.salvarProvaPreviewNoFirebase(prova);
            alert('Questão atualizada com sucesso.');
            document.getElementById('editor-fase1-modal')?.remove();
            this.fecharModalProva();
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao salvar questão da Fase 1:', erro);
            alert('Erro ao salvar questão. Verifique conexão e permissões do Firebase.');
        }
    },

    abrirEditorFase2(index) {
        const prova = this.estado.provaEmPreview;

        if (!prova || !prova.fases || !Array.isArray(prova.fases.fase2)) {
            alert('Não foi possível carregar esta interação para edição.');
            return;
        }

        const itemOriginal = prova.fases.fase2[index];

        if (!itemOriginal) {
            alert('Interação não encontrada.');
            return;
        }

        const item = this.normalizarInteracaoFase2(itemOriginal, index);

        while (item.audios.length < 2) {
            item.audios.push({
                titulo: `Audio ${item.audios.length + 1}`,
                audioUrl: '',
                imageUrl: '',
                transcript: '',
                model: '',
                problem: '',
                modelAnswer: '',
                controllerQuestion: '',
                controllerAnswer: ''
            });
        }

        const audio1 = item.audios[0] || {};
        const audio2 = item.audios[1] || {};
        const interacaoAtual = Number(item.interacao || index + 1);
        const permiteImagem = [4, 5].includes(interacaoAtual);
        const audioProblem = item.audios.find((audio) => audio.problem || audio.modelAnswer || audio.imageUrl) || audio1;
        const controllerFonte = [...item.audios].reverse().find((audio) => audio.controllerQuestion || audio.controllerAnswer) || audio2;

        document.getElementById('editor-fase2-modal')?.remove();

        const html = `
            <div id="editor-fase2-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;">
                <div style="width:100%;max-width:940px;max-height:92vh;overflow:auto;background:#ffffff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.35);box-sizing:border-box;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
                        <div>
                            <h2 style="margin:0;font-size:20px;color:#0f172a;">Editar Interaction — Fase 2</h2>
                            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Sequência oficial: Scenario → Audio 1 → Problem → Audio 2 → What did the controller say?</p>
                        </div>
                        <button id="btn-fechar-editor-fase2" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;">Fechar</button>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                        <div>
                            <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">ID da Prova</label>
                            <input id="edit-fase2-idprova" value="${item.idProva || ''}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;">
                        </div>
                        <div>
                            <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Número da Interaction</label>
                            <select id="edit-fase2-interacao" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;">
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(item.interacao) === n ? 'selected' : ''}>Interaction ${n}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#334155;font-size:13px;">
                        <input type="checkbox" id="edit-fase2-bloco-linear" ${item.blocoLinear !== false ? 'checked' : ''}>
                        Manter bloco linear
                    </label>

                    <section style="border:1px solid #bae6fd;border-radius:14px;padding:14px;margin-bottom:14px;background:#f0f9ff;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#0369a1;">1. Scenario</h3>
                        ${this.criarCampoRichTextPlain({ id: 'edit-fase2-scenario', valor: item.scenario || '', minHeight: 120, placeholder: 'Digite o scenario' })}
                    </section>

                    <section class="fase2-audio-editor" data-audio-index="0" style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;background:#f8fafc;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">2. Audio 1 → Transcript 1 → Model 1</h3>

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Título do Audio 1</label>
                        <input class="edit-fase2-audio-titulo" value="${audio1.titulo || 'Audio 1'}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Audio 1 URL</label>
                        <input class="edit-fase2-audio" value="${audio1.audioUrl || ''}" placeholder="URL atual ou caminho legado" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;">
                        <input type="file" class="edit-fase2-audio-file" accept="audio/*" style="width:100%;box-sizing:border-box;padding:10px;background:#fff;border:1px dashed #94a3b8;border-radius:10px;margin-bottom:8px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin:12px 0 6px;">Transcript 1</label>
                        ${this.criarCampoRichTextPlain({ id: 'edit-fase2-transcript-0', valor: audio1.transcript || '', minHeight: 110, placeholder: 'Transcript 1' })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Model 1</label>
                        ${this.criarCampoRichText({ id: 'edit-fase2-model-0', valor: audio1.model || '', minHeight: 150 })}
                    </section>

                    <section style="border:1px solid #fed7aa;border-radius:14px;padding:14px;margin-bottom:14px;background:#fff7ed;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#9a3412;">${permiteImagem ? '3. Problem Image → 4. Problem → 5. Model Answer' : '3. Problem → 4. Model Answer'}</h3>

                        <div style="padding:10px;border-radius:10px;background:#fff;border:1px solid #fed7aa;color:#9a3412;font-size:12px;line-height:1.5;margin-bottom:12px;">
                            A imagem do Problem só será exibida no simulado nas Interactions 4 e 5.
                        </div>

                        <label style="display:block;font-size:12px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Problem Image URL</label>
                        <input id="edit-fase2-problem-image" value="${audioProblem.imageUrl || ''}" placeholder="Somente para interactions 4 e 5" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #fed7aa;border-radius:10px;margin-bottom:8px;">
                        <input type="file" id="edit-fase2-problem-image-file" accept="image/*" style="width:100%;box-sizing:border-box;padding:10px;background:#fff;border:1px dashed #fb923c;border-radius:10px;margin-bottom:12px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Problem</label>
                        ${this.criarCampoRichText({ id: 'edit-fase2-problem-central', valor: audioProblem.problem || '', minHeight: 140 })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Model Answer / Request Model</label>
                        ${this.criarCampoRichText({ id: 'edit-fase2-model-answer-central', valor: audioProblem.modelAnswer || '', minHeight: 150 })}
                    </section>

                    <section class="fase2-audio-editor" data-audio-index="1" style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;background:#f8fafc;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">${permiteImagem ? '6' : '5'}. Audio 2 → Transcript 2 → Model 2</h3>

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Título do Audio 2</label>
                        <input class="edit-fase2-audio-titulo" value="${audio2.titulo || 'Audio 2'}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Audio 2 URL</label>
                        <input class="edit-fase2-audio" value="${audio2.audioUrl || ''}" placeholder="URL atual ou caminho legado" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;">
                        <input type="file" class="edit-fase2-audio-file" accept="audio/*" style="width:100%;box-sizing:border-box;padding:10px;background:#fff;border:1px dashed #94a3b8;border-radius:10px;margin-bottom:8px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin:12px 0 6px;">Transcript 2</label>
                        ${this.criarCampoRichTextPlain({ id: 'edit-fase2-transcript-1', valor: audio2.transcript || '', minHeight: 110, placeholder: 'Transcript 2' })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Model 2</label>
                        ${this.criarCampoRichText({ id: 'edit-fase2-model-1', valor: audio2.model || '', minHeight: 150 })}
                    </section>

                    <section style="border:1px solid #ddd6fe;border-radius:14px;padding:14px;margin-bottom:14px;background:#faf5ff;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#5b21b6;">${permiteImagem ? '7' : '6'}. What did the controller say? <span style="font-weight:600;color:#7c3aed;">(opcional)</span></h3>

                        <label style="display:block;font-size:12px;font-weight:800;color:#5b21b6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pergunta/título</label>
                        <input id="edit-fase2-controller-question-final" value="${controllerFonte.controllerQuestion || ''}" placeholder="Ex: What did the controller say? — deixe em branco para ocultar" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #ddd6fe;border-radius:10px;margin-bottom:12px;">

                        <label style="display:block;font-size:12px;font-weight:800;color:#5b21b6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Resposta</label>
                        ${this.criarCampoRichText({ id: 'edit-fase2-controller-answer-final', valor: controllerFonte.controllerAnswer || '', minHeight: 140 })}
                    </section>

                    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px;">
                        <button id="btn-cancelar-edicao-fase2" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:800;">Cancelar</button>
                        <button id="btn-salvar-edicao-fase2" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800;">Salvar interaction</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.ativarToolbarsRichText(document.getElementById('editor-fase2-modal'));

        const fechar = () => document.getElementById('editor-fase2-modal')?.remove();
        document.getElementById('btn-fechar-editor-fase2').onclick = fechar;
        document.getElementById('btn-cancelar-edicao-fase2').onclick = fechar;
        document.getElementById('btn-salvar-edicao-fase2').onclick = () => this.salvarEdicaoFase2(index);
    },
    async salvarEdicaoFase2(index) {
        const prova = this.estado.provaEmPreview;

        if (!prova || !prova.fases || !Array.isArray(prova.fases.fase2)) {
            alert('Não foi possível salvar. A prova não está carregada corretamente.');
            return;
        }

        const item = prova.fases.fase2[index];

        if (!item) {
            alert('Interaction não encontrada para salvar.');
            return;
        }

        const idProva = document.getElementById('edit-fase2-idprova')?.value?.trim() || prova.id;
        const interacao = Number(document.getElementById('edit-fase2-interacao')?.value || index + 1);
        const blocoLinear = document.getElementById('edit-fase2-bloco-linear')?.checked !== false;
        const scenario = this.normalizarRichText(document.getElementById('edit-fase2-scenario')?.innerHTML || '');
        const btnSalvar = document.getElementById('btn-salvar-edicao-fase2');

        try {
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.innerText = 'Enviando mídias e salvando...';
            }

            const secoesAudios = Array.from(document.querySelectorAll('#editor-fase2-modal .fase2-audio-editor'));
            const audios = [];

            for (const section of secoesAudios) {
                const audioIndex = Number(section.dataset.audioIndex);

                let audioUrl = section.querySelector('.edit-fase2-audio')?.value?.trim() || '';
                const arquivoAudio = section.querySelector('.edit-fase2-audio-file')?.files?.[0] || null;

                if (arquivoAudio) {
                    audioUrl = await this.uploadMidiaProva({
                        arquivo: arquivoAudio,
                        provaId: prova.id,
                        fase: 'fase2',
                        itemIndex: index,
                        blocoIndex: audioIndex,
                        campo: 'audio'
                    });
                }

                audios[audioIndex] = {
                    titulo: section.querySelector('.edit-fase2-audio-titulo')?.value?.trim() || `Audio ${audioIndex + 1}`,
                    audioUrl,
                    imageUrl: '',
                    transcript: this.normalizarRichText(document.getElementById(`edit-fase2-transcript-${audioIndex}`)?.innerHTML || ''),
                    model: this.normalizarRichText(document.getElementById(`edit-fase2-model-${audioIndex}`)?.innerHTML || ''),
                    problem: '',
                    modelAnswer: '',
                    controllerQuestion: '',
                    controllerAnswer: ''
                };
            }

            let problemImageUrl = document.getElementById('edit-fase2-problem-image')?.value?.trim() || '';
            const arquivoImagemProblem = document.getElementById('edit-fase2-problem-image-file')?.files?.[0] || null;

            if (arquivoImagemProblem) {
                problemImageUrl = await this.uploadMidiaProva({
                    arquivo: arquivoImagemProblem,
                    provaId: prova.id,
                    fase: 'fase2',
                    itemIndex: index,
                    blocoIndex: 0,
                    campo: 'problem-image'
                });
            }

            const problem = this.normalizarRichText(document.getElementById('edit-fase2-problem-central')?.innerHTML || '');
            const modelAnswer = this.normalizarRichText(document.getElementById('edit-fase2-model-answer-central')?.innerHTML || '');
            const controllerQuestion = document.getElementById('edit-fase2-controller-question-final')?.value?.trim() || '';
            const controllerAnswer = this.normalizarRichText(document.getElementById('edit-fase2-controller-answer-final')?.innerHTML || '');

            if (!String(scenario).replace(/<[^>]*>/g, '').trim()) {
                alert('O campo Scenario não pode ficar vazio.');
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.innerText = 'Salvar interaction';
                }
                return;
            }

            if (!audios[0] || !audios[1]) {
                alert('A interaction precisa ter Audio 1 e Audio 2.');
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.innerText = 'Salvar interaction';
                }
                return;
            }

            audios[0].problem = problem;
            audios[0].modelAnswer = modelAnswer;
            audios[0].imageUrl = problemImageUrl;

            audios[1].controllerQuestion = controllerQuestion;
            audios[1].controllerAnswer = controllerAnswer;

            item.idProva = idProva;
            item.interacao = interacao;
            item.blocoLinear = blocoLinear;
            item.scenario = scenario;
            item.audios = audios;
            item.conteudo = this.montarConteudoLegadoFase2(item);
            prova.updatedAt = new Date().toISOString();

            await this.salvarProvaPreviewNoFirebase(prova);

            alert('Interaction atualizada com sucesso.');
            document.getElementById('editor-fase2-modal')?.remove();
            this.fecharModalProva();
            this.renderizarProvas();

        } catch (erro) {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.innerText = 'Salvar interaction';
            }

            console.error('Erro ao salvar interaction da Fase 2:', erro, { provaId: prova?.id, index, fases: prova?.fases });
            alert(`Erro ao salvar interaction: ${erro?.message || erro}. Verifique conexão, permissões do Firebase ou regras do Storage.`);
        }
    },
    async duplicarItemFase(fase, index) {
        const prova = this.estado.provaEmPreview;

        if (!prova?.fases?.[fase]?.[index]) {
            alert('Item não encontrado para duplicar.');
            return;
        }

        const copia = JSON.parse(JSON.stringify(prova.fases[fase][index]));

        if (fase === 'fase2') {
            const usadas = new Set((prova.fases.fase2 || []).map((item) => Number(item.interacao)).filter(Boolean));
            let proxima = 1;
            while (usadas.has(proxima) && proxima < 5) proxima++;
            copia.interacao = proxima;
        }

        prova.fases[fase].splice(index + 1, 0, copia);
        prova.updatedAt = new Date().toISOString();

        try {
            await this.salvarProvaPreviewNoFirebase(prova);
            alert('Item duplicado com sucesso.');
            this.abrirPreviewVisual(prova);
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao duplicar item:', erro);
            alert('Erro ao duplicar item.');
        }
    },

    async excluirItemFase(fase, index) {
        const prova = this.estado.provaEmPreview;

        if (!prova?.fases?.[fase]?.[index]) {
            alert('Item não encontrado para excluir.');
            return;
        }

        const confirmar = confirm('Tem certeza que deseja excluir este item da prova?');
        if (!confirmar) return;

        prova.fases[fase].splice(index, 1);
        prova.updatedAt = new Date().toISOString();

        try {
            await this.salvarProvaPreviewNoFirebase(prova);
            alert('Item excluído com sucesso.');
            this.abrirPreviewVisual(prova);
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao excluir item:', erro);
            alert('Erro ao excluir item.');
        }
    },

    criarInputFileMidia({ classe, accept, texto }) {
        return `
            <input type="file" class="${classe}" accept="${accept}" style="width:100%;box-sizing:border-box;padding:10px;background:#fff;border:1px dashed #94a3b8;border-radius:10px;margin-bottom:8px;">
            <div style="font-size:11px;color:#64748b;margin-top:-4px;margin-bottom:12px;">${texto}</div>
        `;
    },

    async adicionarBlocoFase3() {
        const prova = this.estado.provaEmPreview;
        if (!prova) return;

        prova.fases ||= { fase1: [], fase2: [], fase3: [], fase4: [] };
        prova.fases.fase3 ||= [];

        prova.fases.fase3.push({
            idProva: prova.id,
            conteudo: [
                {
                    titulo: 'Nova situação 1',
                    audioUrl: '',
                    transcricao: '',
                    model: '<p>Modelo de resposta.</p>',
                    perguntaFinal: '',
                    respostaFinal: ''
                },
                {
                    titulo: 'Nova situação 2',
                    audioUrl: '',
                    transcricao: '',
                    model: '<p>Modelo de resposta.</p>',
                    perguntaFinal: '',
                    respostaFinal: ''
                },
                {
                    titulo: 'Nova situação 3',
                    audioUrl: '',
                    transcricao: '',
                    model: '<p>Modelo de resposta.</p>',
                    perguntaFinal: '',
                    respostaFinal: ''
                }
            ],
            comparacaoCustomizada: {
                perguntaHTML: '<p>Compare as situações apresentadas.</p>',
                guiaAjudaHTML: '<p>Guia de ajuda.</p>',
                modeloRespostaHTML: '<p>Modelo de resposta da comparação.</p>'
            }
        });

        prova.updatedAt = new Date().toISOString();

        try {
            await this.salvarProvaPreviewNoFirebase(prova);
            alert('Bloco da Fase 3 adicionado.');
            this.abrirPreviewVisual(prova);
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao adicionar Fase 3:', erro);
            alert('Erro ao adicionar bloco da Fase 3.');
        }
    },

    async adicionarPhotoFase4() {
        const prova = this.estado.provaEmPreview;
        if (!prova) return;

        prova.fases ||= { fase1: [], fase2: [], fase3: [], fase4: [] };
        prova.fases.fase4 ||= [];

        prova.fases.fase4.push({
            idProva: prova.id,
            imageUrl: '',
            descricaoHtml: '<p>Descrição da imagem.</p>',
            perguntas: [
                {
                    tipoPergunta: 'before',
                    perguntaTexto: 'What happened before this picture was taken?',
                    respostaTexto: '<p>Resposta esperada para o que aconteceu antes da foto.</p>'
                },
                {
                    tipoPergunta: 'next',
                    perguntaTexto: 'What will happen next?',
                    respostaTexto: '<p>Resposta esperada para o que acontecerá em seguida.</p>'
                },
                {
                    tipoPergunta: 'custom1',
                    perguntaTexto: 'Custom Question 1',
                    respostaTexto: '<p>Resposta esperada.</p>'
                },
                {
                    tipoPergunta: 'custom2',
                    perguntaTexto: 'Custom Question 2',
                    respostaTexto: '<p>Resposta esperada.</p>'
                }
            ],
            statement: {
                textoAfirmacao: '<p>Afirmação para discussão.</p>',
                agreeTexto: '<p>Resposta para I agree.</p>',
                disagreeTexto: '<p>Resposta para I disagree.</p>'
            }
        });

        prova.updatedAt = new Date().toISOString();

        try {
            await this.salvarProvaPreviewNoFirebase(prova);
            alert('Photo da Fase 4 adicionada.');
            this.abrirPreviewVisual(prova);
            this.renderizarProvas();
        } catch (erro) {
            console.error('Erro ao adicionar Fase 4:', erro);
            alert('Erro ao adicionar photo da Fase 4.');
        }
    },

    abrirEditorFase3(index) {
        const prova = this.estado.provaEmPreview;
        const item = prova?.fases?.fase3?.[index];

        if (!item) {
            alert('Bloco da Fase 3 não encontrado.');
            return;
        }

        document.getElementById('editor-fase3-modal')?.remove();

        const situacoesHTML = (item.conteudo || []).map((sit, sitIndex) => `
            <section class="fase3-situacao-editor" data-sit-index="${sitIndex}" style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;background:#f8fafc;">
                <h3 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Situação ${sitIndex + 1}</h3>

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Título</label>
                ${this.criarCampoRichTextPlain({ id: `edit-fase3-titulo-${sitIndex}`, valor: sit.titulo || '', minHeight: 90, placeholder: 'Título da situação' })}

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Audio URL</label>
                <input class="edit-fase3-audio" value="${sit.audioUrl || ''}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;">
                ${this.criarInputFileMidia({ classe: 'edit-fase3-audio-file', accept: 'audio/*', texto: 'Selecione um novo áudio para enviar ao Firebase Storage ao salvar.' })}

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Transcrição</label>
                ${this.criarCampoRichTextPlain({ id: `edit-fase3-transcricao-${sitIndex}`, valor: sit.transcricao || '', minHeight: 110, placeholder: 'Transcrição da situação' })}

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Model</label>
                ${this.criarCampoRichText({ id: `edit-fase3-model-${sitIndex}`, valor: sit.model || '', minHeight: 150 })}

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pergunta Final</label>
                <input class="edit-fase3-pergunta-final" value="${sit.perguntaFinal || ''}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px;">

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Resposta Final</label>
                ${this.criarCampoRichText({ id: `edit-fase3-resposta-${sitIndex}`, valor: sit.respostaFinal || '', minHeight: 150 })}
            </section>
        `).join('');

        const comp = item.comparacaoCustomizada || {};

        const html = `
            <div id="editor-fase3-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;">
                <div style="width:100%;max-width:920px;max-height:92vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.35);box-sizing:border-box;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
                        <div>
                            <h2 style="margin:0;font-size:20px;color:#0f172a;">Editar Bloco — Fase 3</h2>
                            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Bloco ${index + 1} de ${prova.titulo || prova.id}</p>
                        </div>
                        <button id="btn-fechar-editor-fase3" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;">Fechar</button>
                    </div>

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">ID da Prova</label>
                    <input id="edit-fase3-idprova" value="${item.idProva || prova.id}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:14px;">

                    ${situacoesHTML}

                    <section style="border:1px solid #ddd6fe;border-radius:14px;padding:14px;margin-bottom:14px;background:#faf5ff;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#4c1d95;">Comparison</h3>

                        <label style="display:block;font-size:12px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pergunta de comparação</label>
                        ${this.criarCampoRichText({ id: 'edit-fase3-comp-pergunta', valor: comp.perguntaHTML || '', minHeight: 120 })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Guia de ajuda</label>
                        ${this.criarCampoRichText({ id: 'edit-fase3-comp-guia', valor: comp.guiaAjudaHTML || '', minHeight: 140 })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Modelo de resposta</label>
                        ${this.criarCampoRichText({ id: 'edit-fase3-comp-modelo', valor: comp.modeloRespostaHTML || '', minHeight: 160 })}
                    </section>

                    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px;">
                        <button id="btn-cancelar-edicao-fase3" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:800;">Cancelar</button>
                        <button id="btn-salvar-edicao-fase3" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800;">Salvar bloco</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.ativarToolbarsRichText(document.getElementById('editor-fase3-modal'));

        const fechar = () => document.getElementById('editor-fase3-modal')?.remove();
        document.getElementById('btn-fechar-editor-fase3').onclick = fechar;
        document.getElementById('btn-cancelar-edicao-fase3').onclick = fechar;
        document.getElementById('btn-salvar-edicao-fase3').onclick = () => this.salvarEdicaoFase3(index);
    },

    async salvarEdicaoFase3(index) {
        const prova = this.estado.provaEmPreview;
        const item = prova?.fases?.fase3?.[index];

        if (!item) return;

        const btnSalvar = document.getElementById('btn-salvar-edicao-fase3');

        try {
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.innerText = 'Enviando mídias e salvando...';
            }

            item.idProva = document.getElementById('edit-fase3-idprova')?.value?.trim() || prova.id;

            const situacoes = [];

            for (const section of Array.from(document.querySelectorAll('#editor-fase3-modal .fase3-situacao-editor'))) {
                const sitIndex = Number(section.dataset.sitIndex);
                let audioUrl = section.querySelector('.edit-fase3-audio')?.value?.trim() || '';
                const arquivoAudio = section.querySelector('.edit-fase3-audio-file')?.files?.[0] || null;

                if (arquivoAudio) {
                    audioUrl = await this.uploadMidiaProva({
                        arquivo: arquivoAudio,
                        provaId: prova.id,
                        fase: 'fase3',
                        itemIndex: index,
                        blocoIndex: sitIndex,
                        campo: 'audio'
                    });
                }

                const sit = {
                    titulo: this.normalizarRichText(document.getElementById(`edit-fase3-titulo-${sitIndex}`)?.innerHTML || ''),
                    transcricao: this.normalizarRichText(document.getElementById(`edit-fase3-transcricao-${sitIndex}`)?.innerHTML || ''),
                    model: this.normalizarRichText(document.getElementById(`edit-fase3-model-${sitIndex}`)?.innerHTML || ''),
                    perguntaFinal: section.querySelector('.edit-fase3-pergunta-final')?.value?.trim() || '',
                    respostaFinal: this.normalizarRichText(document.getElementById(`edit-fase3-resposta-${sitIndex}`)?.innerHTML || '')
                };

                if (audioUrl) sit.audioUrl = audioUrl;
                situacoes.push(sit);
            }

            item.conteudo = situacoes;
            item.comparacaoCustomizada = {
                perguntaHTML: this.normalizarRichText(document.getElementById('edit-fase3-comp-pergunta')?.innerHTML || ''),
                guiaAjudaHTML: this.normalizarRichText(document.getElementById('edit-fase3-comp-guia')?.innerHTML || ''),
                modeloRespostaHTML: this.normalizarRichText(document.getElementById('edit-fase3-comp-modelo')?.innerHTML || '')
            };

            prova.updatedAt = new Date().toISOString();

            await this.salvarProvaPreviewNoFirebase(prova);

            alert('Bloco da Fase 3 atualizado com sucesso.');
            document.getElementById('editor-fase3-modal')?.remove();
            this.fecharModalProva();
            this.renderizarProvas();

        } catch (erro) {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.innerText = 'Salvar bloco';
            }

            console.error('Erro ao salvar Fase 3:', erro);
            alert('Erro ao salvar Fase 3. Verifique conexão, permissões ou Storage.');
        }
    },

    abrirEditorFase4(index) {
        const prova = this.estado.provaEmPreview;
        const item = prova?.fases?.fase4?.[index];

        if (!item) {
            alert('Photo da Fase 4 não encontrada.');
            return;
        }

        document.getElementById('editor-fase4-modal')?.remove();

        const perguntasNormalizadas = this.normalizarPerguntasFase4(item.perguntas || []);
        item.perguntas = perguntasNormalizadas;

        const perguntasHTML = perguntasNormalizadas.map((p, pIndex) => {
            const metaPergunta = this.obterLabelPerguntaFase4(pIndex, p);
            const somenteLeitura = metaPergunta.fixa;
            const fundo = somenteLeitura ? '#f0f9ff' : '#f8fafc';
            const borda = somenteLeitura ? '#bae6fd' : '#e2e8f0';

            return `
                <section class="fase4-pergunta-editor" data-pergunta-index="${pIndex}" data-tipo-pergunta="${this.obterTipoPerguntaFase4(pIndex, p)}" style="border:1px solid ${borda};border-radius:14px;padding:14px;margin-bottom:14px;background:${fundo};">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                        <h3 style="margin:0;font-size:16px;color:#0f172a;">${metaPergunta.titulo}</h3>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${somenteLeitura ? pill('Pergunta fixa', '#dcfce7', '#166534') : pill('Pergunta customizada', '#fef3c7', '#92400e')}
                            ${pill(metaPergunta.badge, somenteLeitura ? '#dbeafe' : '#f1f5f9', somenteLeitura ? '#1d4ed8' : '#475569')}
                        </div>
                    </div>

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pergunta</label>
                    <input class="edit-fase4-pergunta-texto"
                           value="${escaparHTML(p.perguntaTexto || '')}"
                           ${somenteLeitura ? 'readonly' : ''}
                           style="width:100%;box-sizing:border-box;padding:11px;border:1px solid ${borda};border-radius:10px;margin-bottom:8px;background:${somenteLeitura ? '#e0f2fe' : '#fff'};color:#0f172a;font-weight:${somenteLeitura ? '800' : '500'};">

                    <div style="font-size:11px;color:#64748b;margin-bottom:12px;line-height:1.45;">
                        ${somenteLeitura
                            ? 'Esta pergunta é padrão da Fase 4 e não deve ser alterada. Cadastre apenas a resposta esperada.'
                            : 'Esta pergunta é livre. O administrador pode alterar o texto conforme a necessidade da foto.'}
                    </div>

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Resposta</label>
                    ${this.criarCampoRichText({ id: `edit-fase4-resposta-${pIndex}`, valor: p.respostaTexto || '', minHeight: 140 })}
                </section>
            `;
        }).join('');

        const statement = item.statement || {};

        const html = `
            <div id="editor-fase4-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;">
                <div style="width:100%;max-width:920px;max-height:92vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.35);box-sizing:border-box;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
                        <div>
                            <h2 style="margin:0;font-size:20px;color:#0f172a;">Editar Photo — Fase 4</h2>
                            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Photo ${index + 1} de ${prova.titulo || prova.id}</p>
                        </div>
                        <button id="btn-fechar-editor-fase4" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;">Fechar</button>
                    </div>

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">ID da Prova</label>
                    <input id="edit-fase4-idprova" value="${item.idProva || prova.id}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:14px;">

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Imagem URL</label>
                    <input id="edit-fase4-image-url" value="${item.imageUrl || ''}" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;">
                    ${this.criarInputFileMidia({ classe: 'edit-fase4-image-file', accept: 'image/*', texto: 'Selecione uma nova imagem para enviar ao Firebase Storage ao salvar.' })}

                    <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Descrição da imagem</label>
                    ${this.criarCampoRichText({ id: 'edit-fase4-descricao', valor: item.descricaoHtml || '', minHeight: 180 })}

                    ${perguntasHTML || '<p style="color:#64748b;">Sem perguntas cadastradas.</p>'}

                    <section style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;background:#f8fafc;">
                        <h3 style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Statement</h3>

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Afirmação</label>
                        ${this.criarCampoRichText({ id: 'edit-fase4-statement-texto', valor: statement.textoAfirmacao || '', minHeight: 120 })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">I Agree</label>
                        ${this.criarCampoRichText({ id: 'edit-fase4-statement-agree', valor: statement.agreeTexto || '', minHeight: 140 })}

                        <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">I Disagree</label>
                        ${this.criarCampoRichText({ id: 'edit-fase4-statement-disagree', valor: statement.disagreeTexto || '', minHeight: 140 })}
                    </section>

                    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px;">
                        <button id="btn-cancelar-edicao-fase4" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:800;">Cancelar</button>
                        <button id="btn-salvar-edicao-fase4" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800;">Salvar photo</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.ativarToolbarsRichText(document.getElementById('editor-fase4-modal'));

        const fechar = () => document.getElementById('editor-fase4-modal')?.remove();
        document.getElementById('btn-fechar-editor-fase4').onclick = fechar;
        document.getElementById('btn-cancelar-edicao-fase4').onclick = fechar;
        document.getElementById('btn-salvar-edicao-fase4').onclick = () => this.salvarEdicaoFase4(index);
    },

    async salvarEdicaoFase4(index) {
        const prova = this.estado.provaEmPreview;
        const item = prova?.fases?.fase4?.[index];

        if (!item) return;

        const btnSalvar = document.getElementById('btn-salvar-edicao-fase4');

        try {
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.innerText = 'Enviando imagem e salvando...';
            }

            item.idProva = document.getElementById('edit-fase4-idprova')?.value?.trim() || prova.id;

            let imageUrl = document.getElementById('edit-fase4-image-url')?.value?.trim() || '';
            const arquivoImagem = document.querySelector('#editor-fase4-modal .edit-fase4-image-file')?.files?.[0] || null;

            if (arquivoImagem) {
                imageUrl = await this.uploadMidiaProva({
                    arquivo: arquivoImagem,
                    provaId: prova.id,
                    fase: 'fase4',
                    itemIndex: index,
                    blocoIndex: 0,
                    campo: 'imagem'
                });
            }

            item.imageUrl = imageUrl;
            item.descricaoHtml = this.normalizarRichText(document.getElementById('edit-fase4-descricao')?.innerHTML || '');

            item.perguntas = Array.from(document.querySelectorAll('#editor-fase4-modal .fase4-pergunta-editor')).map((section) => {
                const pIndex = Number(section.dataset.perguntaIndex);
                const tipoPergunta = section.dataset.tipoPergunta || this.obterTipoPerguntaFase4(pIndex, {});
                const metaPergunta = this.obterLabelPerguntaFase4(pIndex, { tipoPergunta });
                const textoCampo = section.querySelector('.edit-fase4-pergunta-texto')?.value?.trim() || '';

                return {
                    tipoPergunta,
                    perguntaTexto: metaPergunta.fixa ? metaPergunta.textoPadrao : textoCampo,
                    respostaTexto: this.normalizarRichText(document.getElementById(`edit-fase4-resposta-${pIndex}`)?.innerHTML || '')
                };
            });

            item.statement = {
                textoAfirmacao: this.normalizarRichText(document.getElementById('edit-fase4-statement-texto')?.innerHTML || ''),
                agreeTexto: this.normalizarRichText(document.getElementById('edit-fase4-statement-agree')?.innerHTML || ''),
                disagreeTexto: this.normalizarRichText(document.getElementById('edit-fase4-statement-disagree')?.innerHTML || '')
            };

            prova.updatedAt = new Date().toISOString();

            await this.salvarProvaPreviewNoFirebase(prova);

            alert('Photo da Fase 4 atualizada com sucesso.');
            document.getElementById('editor-fase4-modal')?.remove();
            this.fecharModalProva();
            this.renderizarProvas();

        } catch (erro) {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.innerText = 'Salvar photo';
            }

            console.error('Erro ao salvar Fase 4:', erro);
            alert('Erro ao salvar Fase 4. Verifique conexão, permissões ou Storage.');
        }
    },

    async uploadMidiaProva({ arquivo, provaId, fase, itemIndex, blocoIndex = 0, campo = 'midia' }) {
        if (!arquivo) return '';

        const nomeSeguro = normalizarNomeArquivo(arquivo.name || 'arquivo');
        const caminho = `provas/${provaId}/${fase}/item-${itemIndex + 1}/bloco-${blocoIndex + 1}/${campo}-${Date.now()}-${nomeSeguro}`;

        const storageRef = ref(storage, caminho);

        await uploadBytes(storageRef, arquivo, {
            contentType: arquivo.type || undefined
        });

        return await getDownloadURL(storageRef);
    },

    async abrirCriadorProvaVisual() {
        const modal = document.getElementById('modal-prova');
        const form = document.getElementById('form-json-prova');
        const preview = document.getElementById('preview-prova-admin-container');

        this.estado.provaEmEdicaoId = null;
        this.estado.provaEmPreview = null;

        modal.style.display = 'block';
        document.getElementById('modal-prova-titulo').innerText = 'Criar nova prova';

        if (form) form.style.display = 'none';
        if (!preview) return;

        preview.innerHTML = `
            <div style="background:#f8fafc;color:#0f172a;border-radius:14px;padding:16px;">
                <div style="background:#0f172a;color:#fff;border-radius:12px;padding:16px;margin-bottom:16px;">
                    <h2 style="margin:0 0 6px 0;font-size:20px;color:#fff;">Nova prova</h2>
                    <p style="margin:0;color:#94a3b8;font-size:13px;">Crie a prova no padrão visual do CMS. Depois de criada, você poderá adicionar questões e interações.</p>
                </div>

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Título da prova</label>
                <input id="nova-prova-titulo" placeholder="Ex: Modelo Prova Charlie"
                    style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px;">

                <label style="display:block;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">ID do documento / idProva</label>
                <input id="nova-prova-id" placeholder="Ex: modelo_prova_charlie"
                    style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px;">

                <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#334155;font-size:13px;">
                    <input type="checkbox" id="nova-prova-ativa" checked>
                    Prova ativa para alunos
                </label>

                <div style="padding:10px;border-radius:10px;background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;font-size:12px;line-height:1.5;margin-bottom:16px;">
                    O ID será usado para agrupar todas as fases da prova. Use letras minúsculas, números e underline.
                </div>

                <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
                    <button id="btn-cancelar-criar-prova" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:800;">
                        Cancelar
                    </button>

                    <button id="btn-confirmar-criar-prova" style="background:#06b6d4;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800;">
                        Criar prova
                    </button>
                </div>
            </div>
        `;

        const tituloInput = document.getElementById('nova-prova-titulo');
        const idInput = document.getElementById('nova-prova-id');

        tituloInput?.addEventListener('input', () => {
            if (!idInput.value.trim()) {
                idInput.value = gerarIdDocumentoBase(tituloInput.value);
            }
        });

        document.getElementById('btn-cancelar-criar-prova').onclick = () => {
            this.fecharModalProva();
        };

        document.getElementById('btn-confirmar-criar-prova').onclick = async () => {
            const titulo = tituloInput.value.trim() || 'Nova prova';
            const id = gerarIdDocumentoBase(idInput.value.trim() || titulo);
            const ativa = document.getElementById('nova-prova-ativa')?.checked !== false;

            const payload = {
                titulo,
                ativa,
                origem: 'cms_visual',
                fases: {
                    fase1: [],
                    fase2: [],
                    fase3: [],
                    fase4: []
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, 'provas', id), payload, { merge: false });

                const prova = { id, ...payload };

                alert('Prova criada com sucesso.');
                await this.renderizarProvas();
                this.abrirPreviewVisual(prova);
            } catch (erro) {
                console.error('Erro ao criar prova:', erro);
                alert('Erro ao criar prova. Verifique se o ID já existe ou se as permissões do Firebase estão corretas.');
            }
        };
    },

    async adicionarQuestaoFase1() {
        const prova = this.estado.provaEmPreview;
        if (!prova) return;

        prova.fases ||= { fase1: [], fase2: [], fase3: [], fase4: [] };
        prova.fases.fase1 ||= [];

        prova.fases.fase1.push({
            idProva: prova.id,
            tituloContexto: 'Nova pergunta da Fase 1',
            modeloResposta: '<p>Escreva aqui o modelo de resposta.</p>'
        });

        prova.updatedAt = new Date().toISOString();

        await this.salvarProvaPreviewNoFirebase(prova);
        this.abrirPreviewVisual(prova);
        this.renderizarProvas();
    },

    async adicionarInteracaoFase2() {
        const prova = this.estado.provaEmPreview;
        if (!prova) return;

        prova.fases ||= { fase1: [], fase2: [], fase3: [], fase4: [] };
        prova.fases.fase2 ||= [];

        const usadas = new Set((prova.fases.fase2 || []).map((item) => Number(item.interacao)).filter(Boolean));
        let proxima = 1;
        while (usadas.has(proxima) && proxima < 5) proxima++;

        prova.fases.fase2.push({
            idProva: prova.id,
            interacao: proxima,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: 'bloco-audio',
                    titulo: 'Novo bloco da interação',
                    transcricao: '',
                    model: '<p>Escreva aqui o modelo de resposta.</p>'
                }
            ]
        });

        prova.updatedAt = new Date().toISOString();

        await this.salvarProvaPreviewNoFirebase(prova);
        this.abrirPreviewVisual(prova);
        this.renderizarProvas();
    },

    async salvarProvaPreviewNoFirebase(prova) {
        const payload = limparDadosFirebase({
            titulo: prova.titulo || prova.id,
            ativa: prova.ativa !== false,
            fases: prova.fases || {
                fase1: [],
                fase2: [],
                fase3: [],
                fase4: []
            },
            updatedAt: prova.updatedAt || new Date().toISOString()
        });

        await setDoc(
            doc(db, 'provas', prova.id),
            payload,
            { merge: true }
        );
    }

};
