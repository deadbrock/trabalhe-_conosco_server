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
  foto_url?: string;
  ctps_url?: string;
  rg_frente_url?: string;
  rg_verso_url?: string;
  comprovante_residencia_url?: string;
  titulo_eleitor_url?: string;
  certidao_nascimento_url?: string;
  reservista_url?: string;
  antecedentes_criminais_url?: string;
  certidao_dependente_url?: string;
  cpf_dependente_url?: string;
  
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
      // Documentos de admissão
      foto_url: candidato.foto_url || undefined,
      ctps_url: candidato.ctps_url || undefined,
      rg_frente_url: candidato.rg_frente_url || undefined,
      rg_verso_url: candidato.rg_verso_url || undefined,
      comprovante_residencia_url: candidato.comprovante_residencia_url || undefined,
      titulo_eleitor_url: candidato.titulo_eleitor_url || undefined,
      certidao_nascimento_url: candidato.certidao_nascimento_url || undefined,
      reservista_url: candidato.reservista_url || undefined,
      antecedentes_criminais_url: candidato.antecedentes_criminais_url || undefined,
      certidao_dependente_url: candidato.certidao_dependente_url || undefined,
      cpf_dependente_url: candidato.cpf_dependente_url || undefined,
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
  // Declarar variáveis fora do try para acesso no catch
  let fgsUrl: string | undefined;
  let fgsApiKey: string | undefined;
  
  try {
    // Verificar se a URL do FGS está configurada
    fgsUrl = process.env.FGS_API_URL?.trim();
    fgsApiKey = process.env.FGS_API_KEY?.trim();
    
    if (!fgsUrl) {
      throw new Error('FGS_API_URL não configurada. Configure a variável de ambiente FGS_API_URL com a URL do sistema FGS.');
    }
    
    // Validar URL (deve ser uma URL válida, não apenas domínio)
    if (!fgsUrl.startsWith('http://') && !fgsUrl.startsWith('https://')) {
      throw new Error(`FGS_API_URL inválida. Deve começar com http:// ou https://. Valor atual: ${fgsUrl}`);
    }
    
    // Validar e limpar API key (remover quebras de linha, espaços extras, etc.)
    if (fgsApiKey) {
      fgsApiKey = fgsApiKey.replace(/\r\n/g, '').replace(/\n/g, '').trim();
      
      // Verificar se não é um exemplo/documentação
      if (fgsApiKey.toLowerCase().includes('curl') || 
          fgsApiKey.toLowerCase().includes('exemplo') || 
          fgsApiKey.toLowerCase().includes('sua-api-key') ||
          fgsApiKey.toLowerCase().includes('seu-sistema-fgs')) {
        console.warn('⚠️ FGS_API_KEY parece ser um exemplo/documentação. Configure um token real.');
        fgsApiKey = undefined; // Não usar se for exemplo
      }
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
        foto_url: dadosCandidato.foto_url,
        ctps_url: dadosCandidato.ctps_url,
        rg_frente_url: dadosCandidato.rg_frente_url,
        rg_verso_url: dadosCandidato.rg_verso_url,
        comprovante_residencia_url: dadosCandidato.comprovante_residencia_url,
        titulo_eleitor_url: dadosCandidato.titulo_eleitor_url,
        certidao_nascimento_url: dadosCandidato.certidao_nascimento_url,
        reservista_url: dadosCandidato.reservista_url,
        antecedentes_criminais_url: dadosCandidato.antecedentes_criminais_url,
        certidao_dependente_url: dadosCandidato.certidao_dependente_url,
        cpf_dependente_url: dadosCandidato.cpf_dependente_url,
      },
      
      // Informações da vaga
      // Nota: Não enviamos vaga.id porque o FGS espera UUID, mas nosso sistema usa integer
      // O FGS pode usar o título ou buscar a vaga por outros critérios
      vaga: {
        // id: dadosCandidato.vaga_id, // Removido - FGS espera UUID, não integer
        titulo: dadosCandidato.vaga_titulo,
        id_origem: dadosCandidato.vaga_id, // ID do sistema origem (para referência)
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
      tem_api_key: !!fgsApiKey,
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
      const status = error.response.status;
      const errorData = error.response.data;
      
      console.error('❌ Erro da API FGS:', {
        status,
        data: errorData,
        url: fgsUrl || 'não configurada',
      });
      
      return {
        success: false,
        message: `Erro ao comunicar com FGS (${status}): ${errorData?.error || errorData?.message || error.response.statusText}`,
      };
    } else if (error.request) {
      // Erro de conexão
      console.error('❌ Erro de conexão com FGS:', {
        url: fgsUrl || 'não configurada',
        message: error.message,
      });
      
      return {
        success: false,
        message: `Erro de conexão com o sistema FGS. Verifique se o serviço está online e a URL está correta: ${fgsUrl || 'não configurada'}`,
      };
    } else {
      // Outro erro
      console.error('❌ Erro desconhecido ao enviar para FGS:', error);
      
      return {
        success: false,
        message: error.message || 'Erro desconhecido ao enviar para FGS',
      };
    }
  }
}

