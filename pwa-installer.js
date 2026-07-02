// pwa-installer.js

let deferredPrompt = null;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const INSTALL_DISMISSED_KEY = 'chiteroicao_pwa_install_dismissed_at';
const DISMISS_TIMEOUT_MS = 1000 * 60 * 60 * 24;

function foiDispensadoRecentemente() {
    try {
        const valor = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
        return valor && Date.now() - valor < DISMISS_TIMEOUT_MS;
    } catch {
        return false;
    }
}

function marcarDispensado() {
    try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {}
}

const style = document.createElement('style');
style.textContent = `
    .pwa-install-banner {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(140px);
        background: #111111;
        border: 1px solid #222222;
        box-shadow: 0 10px 30px rgba(0,0,0,0.55);
        border-radius: 14px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 99999;
        width: calc(100% - 28px);
        max-width: 430px;
        box-sizing: border-box;
        transition: transform 0.35s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .pwa-install-banner.show { transform: translateX(-50%) translateY(0); }
    .pwa-text-content { flex: 1; min-width: 0; }
    .pwa-title { color: #ffffff; font-size: 13px; font-weight: 800; margin: 0 0 3px 0; }
    .pwa-desc { color: #b8c0cc; font-size: 11px; margin: 0; line-height: 1.35; }
    .pwa-btn-install {
        background: #00a8cc;
        color: #ffffff;
        border: none;
        padding: 9px 13px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
    }
    .pwa-btn-close {
        background: transparent;
        border: none;
        color: #777777;
        font-size: 20px;
        cursor: pointer;
        padding: 0 2px;
        line-height: 1;
    }
    @media (max-width: 420px) {
        .pwa-install-banner { bottom: 12px; padding: 12px; gap: 10px; }
        .pwa-btn-install { padding: 8px 10px; font-size: 11px; }
    }
`;
document.head.appendChild(style);

const bannerHtml = `
    <div id="pwa-master-banner" class="pwa-install-banner" role="dialog" aria-live="polite">
        <div class="pwa-text-content">
            <p class="pwa-title">Instalar Chiteroicao</p>
            <p id="pwa-instructions" class="pwa-desc">Use o simulador offline direto da tela inicial.</p>
        </div>
        <button id="pwa-action-btn" class="pwa-btn-install" type="button">Instalar</button>
        <button id="pwa-close-btn" class="pwa-btn-close" type="button" aria-label="Fechar">&times;</button>
    </div>
`;

document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone || foiDispensadoRecentemente()) return;
    document.body.insertAdjacentHTML('beforeend', bannerHtml);
    setupPWAReactivity();
});

function mostrarBanner() {
    const banner = document.getElementById('pwa-master-banner');
    if (!banner || isStandalone || foiDispensadoRecentemente()) return;
    banner.classList.add('show');
}

function ocultarBanner() {
    const banner = document.getElementById('pwa-master-banner');
    if (banner) banner.classList.remove('show');
}

function setupPWAReactivity() {
    const actionBtn = document.getElementById('pwa-action-btn');
    const closeBtn = document.getElementById('pwa-close-btn');
    const instructionsText = document.getElementById('pwa-instructions');

    closeBtn?.addEventListener('click', () => {
        marcarDispensado();
        ocultarBanner();
    });

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        instructionsText.innerText = 'Instale o app para usar o simulador com acesso rápido e modo offline.';
        actionBtn.innerText = 'Instalar';
        actionBtn.disabled = false;
        mostrarBanner();
    });

    actionBtn?.addEventListener('click', async () => {
        if (isIOS) {
            actionBtn.innerText = 'Use o botão compartilhar';
            instructionsText.innerHTML =
                'No Safari, toque em <strong style="color:#fff;">Compartilhar</strong> e depois em <strong style="color:#fff;">Adicionar à Tela de Início</strong>.';
            return;
        }

        if (!deferredPrompt) {
            instructionsText.innerText =
                'Se o botão nativo ainda não apareceu, abra pelo Chrome e aguarde alguns segundos. O app precisa estar em HTTPS.';
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA install outcome: ${outcome}`);
        deferredPrompt = null;
        ocultarBanner();
    });

    if (isIOS) {
        instructionsText.innerHTML =
            'No Safari, toque em <strong style="color:#fff;">Compartilhar</strong> e depois em <strong style="color:#fff;">Adicionar à Tela de Início</strong>.';
        actionBtn.innerText = 'Como instalar';
        actionBtn.style.background = '#222222';
        actionBtn.style.border = '1px solid #333333';
        setTimeout(mostrarBanner, 1800);
    }

    if (!isIOS && isMobile) {
        setTimeout(() => {
            if (!deferredPrompt && !isStandalone && !foiDispensadoRecentemente()) {
                instructionsText.innerText =
                    'Para instalar, abra pelo Chrome. Se disponível, toque em Instalar app no menu do navegador.';
                mostrarBanner();
            }
        }, 3500);
    }

    window.addEventListener('appinstalled', () => {
        console.log('PWA instalado com sucesso.');
        deferredPrompt = null;
        ocultarBanner();
    });
}
