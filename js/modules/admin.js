// js/modules/admin.js

import { db } from '../firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const AdminModule = {
    /**
     * Busca todos os usuários cadastrados como alunos no Firestore
     */
    async listarAlunos() {
        try {
            const q = query(collection(db, "usuarios"), where("perfil", "==", "aluno"));
            const querySnapshot = await getDocs(q);
            const alunos = [];
            
            querySnapshot.forEach((doc) => {
                alunos.push(doc.data());
            });
            
            return alunos;
        } catch (error) {
            console.error("Erro ao listar alunos:", error);
            return [];
        }
    },

    /**
     * Aprova um aluno calculando o tempo de expiração do token de acesso
     * @param {string} uid - ID único do usuário do Firebase
     * @param {string} dias - '7', '30', '60' ou 'vitalicio'
     */
    async aprovarAluno(uid, dias) {
        try {
            const userRef = doc(db, "usuarios", uid);
            let tipoExpiracao = "temporario";
            let dataExpiracao = null;

            if (dias === 'vitalicio') {
                tipoExpiracao = "vitalicio";
            } else {
                const quantidadeDias = parseInt(dias, 10);
                const dataAtual = new Date();
                dataAtual.setDate(dataAtual.getDate() + quantidadeDias);
                dataExpiracao = dataAtual.toISOString(); // Data exata do fim do acesso
            }

            // Atualiza o documento no Firestore
            await updateDoc(userRef, {
                aprovado: true,
                tipoExpiracao: tipoExpiracao,
                tokenExpiracao: dataExpiracao
            });

            return { sucesso: true };
        } catch (error) {
            console.error("Erro ao aprovar aluno:", error);
            return { sucesso: false, erro: error.message };
        }
    }
};