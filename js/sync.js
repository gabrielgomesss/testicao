// js/sync.js

// Ponte simples para futuras rotinas globais de sincronização.
// A sincronização real das provas fica em ./modules/sync-service.js.

import { SyncService } from './modules/sync-service.js';

window.ChiteroSync = {
    sincronizarProvas: (opcoes = {}) => SyncService.sincronizarProvas(opcoes),
    obterProvasCache: () => SyncService.obterProvasCache(),
    obterMetaCache: () => SyncService.obterMetaCache(),
    existeCacheValido: () => SyncService.existeCacheValido(),
    limparCacheProvas: () => SyncService.limparCacheProvas()
};

export { SyncService };
