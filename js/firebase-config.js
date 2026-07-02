// js/firebase-config.js

// 1. Importações dos módulos oficiais do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 2. Configuração do Firebase do projeto Chiteroicao
const firebaseConfig = {
  apiKey: "AIzaSyCxzprd_p7IJMg0tU1CVAk-sofQq1shNG0",
  authDomain: "chiteroicaosim.firebaseapp.com",
  projectId: "chiteroicaosim",
  storageBucket: "chiteroicaosim.firebasestorage.app",
  messagingSenderId: "329633717125",
  appId: "1:329633717125:web:a619d00ec5a182df8dc2ec"
};

// 3. Inicializa o ecossistema do Firebase
const app = initializeApp(firebaseConfig);

// 4. Serviços usados pela aplicação
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configuração de idioma local para e-mails de redefinição de senha
auth.languageCode = 'pt';
