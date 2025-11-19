import axios from 'axios';
import { pool } from '../db';

/**
 * Serviço de integração com o sistema FGS (FG Services)
 * Envia dados de candidatos aprovados para o sistema de admissão
 */

interface DadosCandidatoFGS {
  // Dados pessoais
  nome: string;
  cpf: string;
  data_nascimento?: string;
  email: string;
  telefone?: string;
  
  // Endereço
  estado?: string;
  cidade?: string;
  bairro?: string;
  
  // Documentos
  curriculo_url?: string;
  
  // Informações da vaga
  vaga_id: number;
  vaga_titulo?: string;
  
  // Metadados
  candidato_id: number; // ID no sistema "Trabalhe Conosco"
  data_cadastro?: string;
  status: string;
}

/**
 * Busca dados completos do candidato no banco de dados
 */
export async function buscarDadosCandidato(candidatoId: number): Promise<DadosCandidatoFGS | null> {
  try {
    const { rows } = await pool.query(
      `SELECT 
        c.*,
        v.titulo as vaga_titulo
      FROM candidatos c
      LEFT JOIN vagas v ON c.vaga_id = v.id
      WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (!rows[0]) {
      return null;
    }
    
    const candidato = rows[0];
    
    return {
      nome: candidato.nome,
      cpf: candidato.cpf,
      data_nascimento: candidato.data_nascimento || undefined,
      email: candidato.email,
      telefone: candidato.telefone || undefined,
      estado: candidato.estado || undefined,
      cidade: candidato.cidade || undefined,
      bairro: candidato.bairro || undefined,
      curriculo_url: candidato.curriculo || undefined,
      vaga_id: candidato.vaga_id,
      vaga_titulo: candidato.vaga_titulo || undefined,
      candidato_id: candidato.id,
      data_cadastro: candidato.data_cadastro || undefined,
      status: candidato.status,
    };
  } catch (error) {
    console.error('❌ Erro ao buscar dados do candidato:', error);
    throw error;
  }
}

/**
 * Envia dados do candidato para o sistema FGS
 */
export async function enviarParaFGS(candidatoId: number): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Verificar se a URL do FGS está configurada
    const fgsUrl = process.env.FGS_API_URL;
    const fgsApiKey = process.env.FGS_API_KEY;
    
    if (!fgsUrl) {
      throw new Error('FGS_API_URL não configurada. Configure a variável de ambiente FGS_API_URL com a URL do sistema FGS.');
    }
    
    // Buscar dados completos do candidato
    const dadosCandidato = await buscarDadosCandidato(candidatoId);
    
    if (!dadosCandidato) {
      throw new Error('Candidato não encontrado');
    }
    
    // Verificar se o candidato está aprovado
    if (dadosCandidato.status !== 'aprovado') {
      throw new Error('Apenas candidatos aprovados podem ser enviados para admissão');
    }
    
    // Preparar payload para o FGS
    const payload = {
      // Dados principais
      nome: dadosCandidato.nome,
      cpf: dadosCandidato.cpf,
      email: dadosCandidato.email,
      telefone: dadosCandidato.telefone,
      data_nascimento: dadosCandidato.data_nascimento,
      
      // Endereço
      endereco: {
        estado: dadosCandidato.estado,
        cidade: dadosCandidato.cidade,
        bairro: dadosCandidato.bairro,
      },
      
      // Documentos
      documentos: {
        curriculo_url: dadosCandidato.curriculo_url,
      },
      
      // Informações da vaga
      vaga: {
        id: dadosCandidato.vaga_id,
        titulo: dadosCandidato.vaga_titulo,
      },
      
      // Metadados
      origem: 'trabalhe_conosco',
      candidato_id_origem: dadosCandidato.candidato_id,
      data_cadastro: dadosCandidato.data_cadastro,
    };
    
    // Configurar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Adicionar API key se configurada
    if (fgsApiKey) {
      headers['Authorization'] = `Bearer ${fgsApiKey}`;
      // Ou se o FGS usar outro formato:
      // headers['X-API-Key'] = fgsApiKey;
    }
    
    console.log('📤 Enviando candidato para FGS:', {
      candidato_id: candidatoId,
      nome: dadosCandidato.nome,
      fgs_url: fgsUrl,
    });
    
    // Fazer requisição para o FGS
    const response = await axios.post(fgsUrl, payload, {
      headers,
      timeout: 30000, // 30 segundos de timeout
    });
    
    console.log('✅ Candidato enviado com sucesso para FGS:', {
      candidato_id: candidatoId,
      fgs_response: response.data,
    });
    
    // Marcar candidato como enviado para FGS (opcional - pode criar um campo no banco)
    // await pool.query(
    //   `UPDATE candidatos SET enviado_fgs = true, data_envio_fgs = NOW() WHERE id = $1`,
    //   [candidatoId]
    // );
    
    return {
      success: true,
      message: 'Candidato enviado com sucesso para o sistema FGS',
      data: response.data,
    };
  } catch (error: any) {
    console.error('❌ Erro ao enviar candidato para FGS:', error);
    
    // Tratar diferentes tipos de erro
    if (error.response) {
      // Erro da API do FGS
      return {
        success: false,
        message: `Erro ao comunicar com FGS: ${error.response.data?.message || error.response.statusText}`,
      };
    } else if (error.request) {
      // Erro de conexão
      return {
        success: false,
        message: 'Erro de conexão com o sistema FGS. Verifique se o serviço está online.',
      };
    } else {
      // Outro erro
      return {
        success: false,
        message: error.message || 'Erro desconhecido ao enviar para FGS',
      };
    }
  }
}

