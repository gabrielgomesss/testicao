export const AlunoAulasCard = {
  mount({ onAbrirAulas } = {}) {
    const main = document.querySelector('.dashboard-content');
    const simulado = main?.querySelector('.test-card-premium');
    if (!main || !simulado || document.getElementById('btn-abrir-aulas')) return;

    let wrapper = main.querySelector('.dashboard-cards-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'dashboard-cards-wrapper';
      simulado.parentNode.insertBefore(wrapper, simulado);
      wrapper.appendChild(simulado);
    }

    wrapper.insertAdjacentHTML('beforeend', `
      <article class="test-card-premium aulas-dashboard-card">
        <div class="aulas-dashboard-visual">
          <div class="aulas-dashboard-play">▶</div>
          <div class="aulas-dashboard-badge">Video Lessons</div>
        </div>
        <div class="aulas-dashboard-body">
          <div>
            <h3>Training Classes</h3>
            <ul>
              <li>Aulas em vídeo por módulo</li>
              <li>Download individual para uso offline</li>
              <li>Controle do espaço no dispositivo</li>
              <li>Player integrado ao aplicativo</li>
            </ul>
          </div>
          <button id="btn-abrir-aulas" type="button">Acessar aulas</button>
        </div>
      </article>
    `);

    document.getElementById('btn-abrir-aulas')?.addEventListener('click', () => onAbrirAulas?.());
  }
};
