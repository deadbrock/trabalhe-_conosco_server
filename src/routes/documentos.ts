import { Router, Request, Response } from 'express';
import { pool } from '../db';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { validarQualidadeImagem, detectarRasuras } from '../services/imageValidationService';
import { validarComprovanteResidencia } from '../services/ocrValidationService';
import { enviarNotificacaoDocumentos } from '../services/notificacaoDocumentosService';
import { requireAuth } from '../middleware/auth';
import sharp from 'sharp';

const router = Router();

/**
 * Gera senha aleatória de 7 caracteres (letras e números)
 */
function gerarSenhaAleatoria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem caracteres confusos (I, O, 0, 1)
  let senha = '';
  for (let i = 0; i < 7; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

// Configurar Cloudinary Storage para documentos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'documentos_admissao',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff'],
      transformation: [{ quality: 'auto:good' }],
      resource_type: 'auto', // Permite detectar automaticamente o tipo
    };
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * POST /documentos/login
 * Autentica candidato com CPF + Senha
 * Público (sem autenticação)
 */
// Armazenar sessões em memória (em produção usar Redis)
const sessoes: Map<string, { candidatoId: number; expiraEm: Date }> = new Map();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { cpf, senha } = req.body;
    
    console.log(`🔐 Tentativa de login - CPF: ${cpf}`);
    
    if (!cpf || !senha) {
      return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
    }
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    console.log(`🔍 CPF limpo: ${cpfLimpo}`);
    console.log(`🔍 Senha recebida: ${senha}`);
    
    // Buscar credenciais
    const credResult = await pool.query(
      `SELECT ct.id, ct.candidato_id, ct.senha, ct.expira_em, ct.ativo, c.nome, c.email
       FROM credenciais_temporarias ct
       JOIN candidatos c ON ct.candidato_id = c.id
       WHERE ct.cpf = $1`,
      [cpfLimpo]
    );
    
    console.log(`📊 Credenciais encontradas: ${credResult.rows.length}`);
    
    if (credResult.rows.length > 0) {
      const cred = credResult.rows[0];
      console.log(`📋 Credencial encontrada:`);
      console.log(`  - Ativo: ${cred.ativo}`);
      console.log(`  - Expira em: ${cred.expira_em}`);
      console.log(`  - Senha armazenada: ${cred.senha}`);
      console.log(`  - Senha recebida: ${senha.trim()}`);
      console.log(`  - Senhas iguais: ${cred.senha === senha.trim()}`);
    }
    
    if (credResult.rows.length === 0) {
      console.log(`❌ CPF não encontrado`);
      return res.status(401).json({ error: 'CPF ou senha inválidos' });
    }
    
    const credencial = credResult.rows[0];
    
    // Verificar se está ativo e não expirou
    if (!credencial.ativo || new Date(credencial.expira_em) < new Date()) {
      console.log(`❌ Credenciais inativas ou expiradas`);
      return res.status(401).json({ error: 'CPF ou senha inválidos' });
    }
    
    // Verificar senha
    if (credencial.senha !== senha.trim()) {
      console.log(`❌ Senha incorreta`);
      return res.status(401).json({ error: 'CPF ou senha inválidos' });
    }
    
    console.log(`✅ Login bem-sucedido - Candidato ID: ${credencial.candidato_id} - Nome: ${credencial.nome}`);
    
    // Gerar token para a sessão
    const token = crypto.randomBytes(32).toString('hex');
    
    // Armazenar sessão (expira em 24h)
    const expiraEm = new Date();
    expiraEm.setHours(expiraEm.getHours() + 24);
    sessoes.set(token, { candidatoId: credencial.candidato_id, expiraEm });
    
    console.log(`🔑 Sessão criada - Token: ${token.substring(0, 10)}... - Candidato ID: ${credencial.candidato_id}`);
    
    res.json({
      success: true,
      token,
      candidato: {
        id: credencial.candidato_id,
        nome: credencial.nome,
        email: credencial.email,
      },
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Função auxiliar para obter candidato da sessão
function obterCandidatoIdDaSessao(token: string): number | null {
  const sessao = sessoes.get(token);
  if (!sessao) {
    console.log(`❌ Sessão não encontrada para token: ${token.substring(0, 10)}...`);
    return null;
  }
  if (new Date() > sessao.expiraEm) {
    console.log(`❌ Sessão expirada para token: ${token.substring(0, 10)}...`);
    sessoes.delete(token);
    return null;
  }
  console.log(`✅ Sessão válida - Candidato ID: ${sessao.candidatoId}`);
  return sessao.candidatoId;
}

/**
 * GET /documentos/dados
 * Busca dados do candidato autenticado
 * Público (requer token de sessão)
 */
router.get('/dados', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    console.log(`📋 Buscando dados do candidato - Token: ${token.substring(0, 10)}...`);
    
    // Obter candidato da sessão
    const candidatoId = obterCandidatoIdDaSessao(token);
    
    if (!candidatoId) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    
    console.log(`🔍 Buscando dados do candidato ID: ${candidatoId}`);
    
    const result = await pool.query(
      `SELECT 
        c.id, c.nome, c.email, c.telefone, c.cpf,
        v.titulo as vaga_titulo,
        dc.foto_3x4_url, dc.foto_3x4_validado, dc.foto_3x4_rejeitado, dc.foto_3x4_motivo_rejeicao,
        dc.ctps_digital_url, dc.ctps_digital_validado, dc.ctps_digital_rejeitado, dc.ctps_digital_motivo_rejeicao,
        dc.identidade_frente_url, dc.identidade_frente_validado, dc.identidade_frente_rejeitado, dc.identidade_frente_motivo_rejeicao,
        dc.identidade_verso_url, dc.identidade_verso_validado, dc.identidade_verso_rejeitado, dc.identidade_verso_motivo_rejeicao,
        dc.comprovante_residencia_url, dc.comprovante_residencia_validado, dc.comprovante_residencia_rejeitado, dc.comprovante_residencia_motivo_rejeicao,
        dc.certidao_nascimento_casamento_url, dc.certidao_nascimento_casamento_validado, dc.certidao_nascimento_casamento_rejeitado, dc.certidao_nascimento_casamento_motivo_rejeicao,
        dc.reservista_url, dc.reservista_validado, dc.reservista_rejeitado, dc.reservista_motivo_rejeicao,
        dc.titulo_eleitor_url, dc.titulo_eleitor_validado, dc.titulo_eleitor_rejeitado, dc.titulo_eleitor_motivo_rejeicao,
        dc.antecedentes_criminais_url, dc.antecedentes_criminais_validado, dc.antecedentes_criminais_rejeitado, dc.antecedentes_criminais_motivo_rejeicao,
        dc.certidao_nascimento_dependente_url, dc.certidao_nascimento_dependente_validado, dc.certidao_nascimento_dependente_rejeitado, dc.certidao_nascimento_dependente_motivo_rejeicao,
        dc.cpf_dependente_url, dc.cpf_dependente_validado, dc.cpf_dependente_rejeitado, dc.cpf_dependente_motivo_rejeicao,
        dc.autodeclaracao_racial,
        dc.status
       FROM candidatos c
       LEFT JOIN vagas v ON c.vaga_id = v.id
       LEFT JOIN documentos_candidatos dc ON dc.candidato_id = c.id
       WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidato não encontrado' });
    }
    
    const candidato = result.rows[0];
    
    console.log(`✅ Dados encontrados para: ${candidato.nome}`);
    
    res.json({
      candidato: {
        nome: candidato.nome,
        email: candidato.email,
        telefone: candidato.telefone,
        vaga: candidato.vaga_titulo || 'Não especificada',
      },
      documentos: {
        foto_3x4: {
          url: candidato.foto_3x4_url,
          validado: candidato.foto_3x4_validado || false,
          rejeitado: candidato.foto_3x4_rejeitado || false,
          motivo_rejeicao: candidato.foto_3x4_motivo_rejeicao,
        },
        ctps_digital: {
          url: candidato.ctps_digital_url,
          validado: candidato.ctps_digital_validado || false,
          rejeitado: candidato.ctps_digital_rejeitado || false,
          motivo_rejeicao: candidato.ctps_digital_motivo_rejeicao,
        },
        identidade_frente: {
          url: candidato.identidade_frente_url,
          validado: candidato.identidade_frente_validado || false,
          rejeitado: candidato.identidade_frente_rejeitado || false,
          motivo_rejeicao: candidato.identidade_frente_motivo_rejeicao,
        },
        identidade_verso: {
          url: candidato.identidade_verso_url,
          validado: candidato.identidade_verso_validado || false,
          rejeitado: candidato.identidade_verso_rejeitado || false,
          motivo_rejeicao: candidato.identidade_verso_motivo_rejeicao,
        },
        comprovante_residencia: {
          url: candidato.comprovante_residencia_url,
          validado: candidato.comprovante_residencia_validado || false,
          rejeitado: candidato.comprovante_residencia_rejeitado || false,
          motivo_rejeicao: candidato.comprovante_residencia_motivo_rejeicao,
        },
        certidao_nascimento_casamento: {
          url: candidato.certidao_nascimento_casamento_url,
          validado: candidato.certidao_nascimento_casamento_validado || false,
          rejeitado: candidato.certidao_nascimento_casamento_rejeitado || false,
          motivo_rejeicao: candidato.certidao_nascimento_casamento_motivo_rejeicao,
        },
        reservista: {
          url: candidato.reservista_url,
          validado: candidato.reservista_validado || false,
          rejeitado: candidato.reservista_rejeitado || false,
          motivo_rejeicao: candidato.reservista_motivo_rejeicao,
        },
        titulo_eleitor: {
          url: candidato.titulo_eleitor_url,
          validado: candidato.titulo_eleitor_validado || false,
          rejeitado: candidato.titulo_eleitor_rejeitado || false,
          motivo_rejeicao: candidato.titulo_eleitor_motivo_rejeicao,
        },
        antecedentes_criminais: {
          url: candidato.antecedentes_criminais_url,
          validado: candidato.antecedentes_criminais_validado || false,
          rejeitado: candidato.antecedentes_criminais_rejeitado || false,
          motivo_rejeicao: candidato.antecedentes_criminais_motivo_rejeicao,
        },
        certidao_nascimento_dependente: {
          url: candidato.certidao_nascimento_dependente_url,
          validado: candidato.certidao_nascimento_dependente_validado || false,
          rejeitado: candidato.certidao_nascimento_dependente_rejeitado || false,
          motivo_rejeicao: candidato.certidao_nascimento_dependente_motivo_rejeicao,
        },
        cpf_dependente: {
          url: candidato.cpf_dependente_url,
          validado: candidato.cpf_dependente_validado || false,
          rejeitado: candidato.cpf_dependente_rejeitado || false,
          motivo_rejeicao: candidato.cpf_dependente_motivo_rejeicao,
        },
      },
      status: candidato.status || 'pendente',
    });
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Documentos obrigatórios para verificação de completude
const DOCUMENTOS_OBRIGATORIOS = [
  'foto_3x4',
  'ctps_digital',
  'identidade_frente',
  'identidade_verso',
  'comprovante_residencia',
  'certidao_nascimento_casamento',
  'titulo_eleitor',
  'antecedentes_criminais',
];

// Função para verificar se todos os documentos obrigatórios foram enviados
async function verificarCompletude(candidatoId: number): Promise<{
  completo: boolean;
  documentosEnviados: string[];
  documentosFaltantes: string[];
  autodeclaracaoPreenchida: boolean;
}> {
  const result = await pool.query(
    `SELECT 
      foto_3x4_url, ctps_digital_url, identidade_frente_url, identidade_verso_url,
      comprovante_residencia_url, certidao_nascimento_casamento_url,
      titulo_eleitor_url, antecedentes_criminais_url, autodeclaracao_racial
     FROM documentos_candidatos 
     WHERE candidato_id = $1`,
    [candidatoId]
  );
  
  if (result.rows.length === 0) {
    return {
      completo: false,
      documentosEnviados: [],
      documentosFaltantes: DOCUMENTOS_OBRIGATORIOS,
      autodeclaracaoPreenchida: false,
    };
  }
  
  const doc = result.rows[0];
  const documentosEnviados: string[] = [];
  const documentosFaltantes: string[] = [];
  
  DOCUMENTOS_OBRIGATORIOS.forEach(campo => {
    const campoUrl = `${campo}_url`;
    if (doc[campoUrl]) {
      documentosEnviados.push(campo);
    } else {
      documentosFaltantes.push(campo);
    }
  });
  
  const autodeclaracaoPreenchida = !!doc.autodeclaracao_racial;
  const completo = documentosFaltantes.length === 0 && autodeclaracaoPreenchida;
  
  return { completo, documentosEnviados, documentosFaltantes, autodeclaracaoPreenchida };
}

// Função para notificar RH sobre documentos completos
async function notificarRHDocumentosCompletos(candidatoId: number): Promise<void> {
  try {
    // Buscar dados do candidato
    const candidatoResult = await pool.query(
      `SELECT c.nome, c.email, c.telefone, v.titulo as vaga
       FROM candidatos c
       LEFT JOIN vagas v ON c.vaga_id = v.id
       WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (candidatoResult.rows.length === 0) return;
    
    const candidato = candidatoResult.rows[0];
    
    // Buscar emails do RH
    const rhResult = await pool.query(
      `SELECT email FROM usuarios WHERE role = 'admin' OR role = 'rh'`
    );
    
    // Importar serviço de email
    const { enviarEmail } = require('../services/emailService');
    
    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f4c81 0%, #1e88e5 100%); padding: 30px; border-radius: 15px 15px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📋 Documentos Recebidos</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 15px 15px;">
          <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #0f4c81; margin-top: 0;">Candidato enviou todos os documentos!</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Nome:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${candidato.nome}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${candidato.email}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Telefone:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${candidato.telefone || 'Não informado'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Vaga:</strong></td>
                <td style="padding: 10px 0;">${candidato.vaga || 'Não especificada'}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center;">
            <a href="https://www.trabalheconoscofg.com.br/rh/candidatos" 
               style="display: inline-block; background: linear-gradient(135deg, #0f4c81 0%, #1e88e5 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; 
                      font-weight: bold;">
              Acessar Painel RH
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
            Este é um email automático do sistema Trabalhe Conosco - FG Services
          </p>
        </div>
      </div>
    `;
    
    // Enviar para todos os usuários RH
    for (const rh of rhResult.rows) {
      await enviarEmail({
        destinatario: rh.email,
        assunto: `📋 Documentos Completos - ${candidato.nome}`,
        conteudo: htmlEmail,
      });
      console.log(`📧 Notificação enviada para RH: ${rh.email}`);
    }
    
    // Também enviar email de confirmação para o candidato
    const htmlConfirmacao = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 15px 15px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Documentos Recebidos!</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 15px 15px;">
          <div style="background: white; padding: 20px; border-radius: 10px;">
            <h2 style="color: #28a745; margin-top: 0;">Olá, ${candidato.nome}!</h2>
            
            <p style="color: #333; line-height: 1.6;">
              Recebemos todos os seus documentos com sucesso! 🎉
            </p>
            
            <p style="color: #333; line-height: 1.6;">
              Nossa equipe de RH irá analisar sua documentação e entraremos em contato 
              em breve com os próximos passos do processo de admissão.
            </p>
            
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #2e7d32; margin: 0; font-weight: bold;">
                📋 Status: Documentos enviados - Aguardando análise
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Caso tenha alguma dúvida, entre em contato conosco pelo email 
              <a href="mailto:rh@fgservices.com.br">rh@fgservices.com.br</a>
            </p>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
            FG Services - Trabalhe Conosco
          </p>
        </div>
      </div>
    `;
    
    await enviarEmail({
      destinatario: candidato.email,
      assunto: '✅ Seus documentos foram recebidos - FG Services',
      conteudo: htmlConfirmacao,
    });
    console.log(`📧 Confirmação enviada para candidato: ${candidato.email}`);
    
  } catch (error) {
    console.error('❌ Erro ao notificar RH:', error);
  }
}

/**
 * POST /documentos/upload-foto-3x4
 * Upload de foto 3x4 com processamento automático (crop e redimensionamento)
 * Garante formato 3x4 (proporção 3:4) e centraliza o conteúdo
 * Público (requer token de sessão)
 */

// Configurar multer para memória (para processar com Sharp antes de enviar ao Cloudinary)
const uploadMemory = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas para foto 3x4'));
    }
  }
});

router.post('/upload-foto-3x4', uploadMemory.single('file'), async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const file = req.file;
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    if (!file) {
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }
    
    console.log(`📸 Upload de foto 3x4 - Arquivo: ${file.originalname}`);
    
    // Obter candidato da sessão
    const candidatoId = obterCandidatoIdDaSessao(token);
    
    if (!candidatoId) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    
    console.log(`🔍 Processando foto 3x4 para candidato ID: ${candidatoId}`);
    
    // Processar imagem com Sharp
    // Formato 3x4: proporção 3:4 (ex: 300x400 pixels)
    const LARGURA_3X4 = 300;
    const ALTURA_3X4 = 400;
    
    // Obter metadados da imagem original
    const metadata = await sharp(file.buffer).metadata();
    const { width: originalWidth, height: originalHeight } = metadata;
    
    console.log(`📐 Imagem original: ${originalWidth}x${originalHeight}`);
    
    let processedBuffer: Buffer;
    
    if (originalWidth && originalHeight) {
      const originalRatio = originalWidth / originalHeight;
      const targetRatio = LARGURA_3X4 / ALTURA_3X4; // 0.75
      
      let cropWidth = originalWidth;
      let cropHeight = originalHeight;
      let cropLeft = 0;
      let cropTop = 0;
      
      if (originalRatio > targetRatio) {
        // Imagem mais larga que 3x4 - cortar laterais
        cropWidth = Math.round(originalHeight * targetRatio);
        cropLeft = Math.round((originalWidth - cropWidth) / 2);
      } else if (originalRatio < targetRatio) {
        // Imagem mais alta que 3x4 - cortar topo/base (manter mais do topo para rosto)
        cropHeight = Math.round(originalWidth / targetRatio);
        // Cortar mais da parte inferior para manter o rosto visível
        cropTop = Math.round((originalHeight - cropHeight) * 0.2); // 20% do topo, 80% da base
      }
      
      console.log(`✂️ Crop: ${cropWidth}x${cropHeight} a partir de (${cropLeft}, ${cropTop})`);
      
      // Processar: extrair região, redimensionar e converter para JPEG
      processedBuffer = await sharp(file.buffer)
        .extract({
          left: cropLeft,
          top: cropTop,
          width: cropWidth,
          height: cropHeight
        })
        .resize(LARGURA_3X4, ALTURA_3X4, {
          fit: 'fill',
          position: 'north' // Prioriza a parte superior (rosto)
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      console.log(`✅ Imagem processada: ${LARGURA_3X4}x${ALTURA_3X4}`);
    } else {
      // Se não conseguir obter metadados, apenas redimensionar
      processedBuffer = await sharp(file.buffer)
        .resize(LARGURA_3X4, ALTURA_3X4, {
          fit: 'cover',
          position: 'north'
        })
        .jpeg({ quality: 90 })
        .toBuffer();
    }
    
    // Fazer upload para Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'documentos_admissao',
          resource_type: 'image',
          format: 'jpg',
          transformation: [{ quality: 'auto:good' }],
          public_id: `foto_3x4_${candidatoId}_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(processedBuffer);
    });
    
    const fileUrl = uploadResult.secure_url;
    console.log(`☁️ Foto 3x4 enviada ao Cloudinary: ${fileUrl}`);
    
    // Atualizar banco de dados
    const campoUrl = 'foto_3x4_url';
    const campoValidado = 'foto_3x4_validado';
    const campoRejeitado = 'foto_3x4_rejeitado';
    
    await pool.query(
      `UPDATE documentos_candidatos 
       SET ${campoUrl} = $1, ${campoValidado} = false, ${campoRejeitado} = false, data_ultimo_upload = NOW()
       WHERE candidato_id = $2`,
      [fileUrl, candidatoId]
    );
    
    console.log(`✅ Foto 3x4 salva para candidato ${candidatoId}`);
    
    // Verificar completude
    const completude = await verificarCompletude(candidatoId);
    console.log(`📊 Completude: ${completude.documentosEnviados.length}/${DOCUMENTOS_OBRIGATORIOS.length} documentos`);
    
    if (completude.completo) {
      console.log(`🎉 Candidato ${candidatoId} completou todos os documentos!`);
      
      await pool.query(
        `UPDATE documentos_candidatos 
         SET status = 'documentos_enviados', data_conclusao = NOW()
         WHERE candidato_id = $1`,
        [candidatoId]
      );
      
      await pool.query(
        `UPDATE candidatos SET status = 'documentos_enviados' WHERE id = $1`,
        [candidatoId]
      );
      
      notificarRHDocumentosCompletos(candidatoId);
    }
    
    res.json({
      success: true,
      url: fileUrl,
      message: 'Foto 3x4 processada e enviada com sucesso!',
      dimensoes: { largura: LARGURA_3X4, altura: ALTURA_3X4 },
      completude: {
        documentosEnviados: completude.documentosEnviados.length,
        documentosFaltantes: completude.documentosFaltantes,
        autodeclaracaoPreenchida: completude.autodeclaracaoPreenchida,
        completo: completude.completo,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro no upload da foto 3x4:', error);
    res.status(500).json({ error: 'Erro ao processar foto 3x4: ' + error.message });
  }
});

/**
 * POST /documentos/upload
 * Upload de documento
 * Público (requer token de sessão)
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { tipo_documento } = req.body;
    const file = req.file;
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    if (!file) {
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }
    
    if (!tipo_documento) {
      return res.status(400).json({ error: 'Tipo de documento não fornecido' });
    }
    
    console.log(`📤 Upload de ${tipo_documento} - Arquivo: ${file.originalname}`);
    
    // Obter candidato da sessão
    const candidatoId = obterCandidatoIdDaSessao(token);
    
    if (!candidatoId) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    
    console.log(`🔍 Upload para candidato ID: ${candidatoId}`);
    
    // URL do arquivo no Cloudinary
    const fileUrl = (file as any).path;
    
    console.log(`✅ Arquivo enviado: ${fileUrl}`);
    
    // Atualizar banco de dados
    const campoUrl = `${tipo_documento}_url`;
    const campoValidado = `${tipo_documento}_validado`;
    const campoRejeitado = `${tipo_documento}_rejeitado`;
    
    await pool.query(
      `UPDATE documentos_candidatos 
       SET ${campoUrl} = $1, ${campoValidado} = false, ${campoRejeitado} = false,
           data_ultimo_upload = NOW()
       WHERE candidato_id = $2`,
      [fileUrl, candidatoId]
    );
    
    console.log(`✅ Documento ${tipo_documento} atualizado no banco`);
    
    // Verificar se todos os documentos foram enviados
    const completude = await verificarCompletude(candidatoId);
    console.log(`📊 Completude: ${completude.documentosEnviados.length}/${DOCUMENTOS_OBRIGATORIOS.length} documentos | Autodeclaração: ${completude.autodeclaracaoPreenchida}`);
    
    if (completude.completo) {
      console.log(`🎉 Candidato ${candidatoId} completou todos os documentos!`);
      
      // Atualizar status para "documentos_enviados"
      await pool.query(
        `UPDATE documentos_candidatos 
         SET status = 'documentos_enviados', data_conclusao = NOW()
         WHERE candidato_id = $1`,
        [candidatoId]
      );
      
      // Atualizar status do candidato
      await pool.query(
        `UPDATE candidatos SET status = 'documentos_enviados' WHERE id = $1`,
        [candidatoId]
      );
      
      // Notificar RH (assíncrono, não bloqueia a resposta)
      notificarRHDocumentosCompletos(candidatoId);
    }
    
    res.json({
      success: true,
      url: fileUrl,
      message: 'Documento enviado com sucesso!',
      completude: {
        documentosEnviados: completude.documentosEnviados.length,
        documentosFaltantes: completude.documentosFaltantes,
        autodeclaracaoPreenchida: completude.autodeclaracaoPreenchida,
        completo: completude.completo,
      },
    });
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

/**
 * POST /documentos/gerar-credenciais/:candidatoId
 * Gera CPF + Senha para candidato aprovado enviar documentos
 * Requer autenticação (RH)
 */
router.post('/gerar-credenciais/:candidatoId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { candidatoId } = req.params;
    const { enviarNotificacao = true } = req.body;
    
    console.log(`📋 Gerando credenciais de documentos para candidato ID: ${candidatoId}`);
    
    // Verificar se candidato existe e está aprovado
    const candidatoResult = await pool.query(
      `SELECT c.id, c.nome, c.email, c.telefone, c.status, c.vaga_id, v.titulo as vaga_titulo 
       FROM candidatos c
       LEFT JOIN vagas v ON c.vaga_id = v.id
       WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (candidatoResult.rows.length === 0) {
      console.log(`❌ Candidato ${candidatoId} não encontrado`);
      return res.status(404).json({ error: 'Candidato não encontrado' });
    }
    
    const candidato = candidatoResult.rows[0];
    
    console.log(`✅ Candidato encontrado: ${candidato.nome} | Status: ${candidato.status}`);
    
    if (candidato.status !== 'aprovado') {
      console.log(`❌ Status inválido: ${candidato.status} (esperado: aprovado)`);
      return res.status(400).json({ error: 'Apenas candidatos aprovados podem receber link de documentos' });
    }
    
    // Buscar CPF do candidato
    const cpfResult = await pool.query(
      `SELECT cpf FROM candidatos WHERE id = $1`,
      [candidatoId]
    );
    
    if (!cpfResult.rows[0]?.cpf) {
      console.log(`❌ CPF não encontrado para candidato ${candidatoId}`);
      return res.status(400).json({ error: 'CPF do candidato não encontrado' });
    }
    
    const cpf = cpfResult.rows[0].cpf.replace(/\D/g, ''); // Remove formatação
    
    // Verificar se já existem credenciais ativas
    const credExistenteResult = await pool.query(
      `SELECT id, senha FROM credenciais_temporarias 
       WHERE candidato_id = $1 AND ativo = true AND expira_em > NOW()`,
      [candidatoId]
    );
    
    let senha: string;
    let novoRegistro = false;
    
    if (credExistenteResult.rows.length > 0) {
      // Usar senha existente
      senha = credExistenteResult.rows[0].senha;
      console.log(`🔄 Usando credenciais existentes`);
    } else {
      // Gerar nova senha
      senha = gerarSenhaAleatoria();
      novoRegistro = true;
      
      // Desativar credenciais antigas (se houver)
      await pool.query(
        `UPDATE credenciais_temporarias SET ativo = false WHERE candidato_id = $1`,
        [candidatoId]
      );
      
      // Criar novas credenciais
      await pool.query(
        `INSERT INTO credenciais_temporarias (candidato_id, cpf, senha, expira_em)
         VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
        [candidatoId, cpf, senha]
      );
      
      console.log(`✅ Novas credenciais geradas`);
    }
    
    // Criar/atualizar registro na tabela documentos_candidatos (se não existir)
    const docExistenteResult = await pool.query(
      `SELECT id FROM documentos_candidatos WHERE candidato_id = $1`,
      [candidatoId]
    );
    
    if (docExistenteResult.rows.length === 0) {
      // Gerar um token único para o registro
      const tokenAcesso = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO documentos_candidatos (candidato_id, token_acesso, token_expira_em)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [candidatoId, tokenAcesso]
      );
    }
    
    const linkDocumentos = `${process.env.FRONTEND_URL}/documentos`;
    
    console.log(`🔗 Link de acesso: ${linkDocumentos}`);
    console.log(`👤 CPF: ${cpf}`);
    console.log(`🔑 Senha: ${senha}`);
    console.log(`📧 Enviar notificação: ${enviarNotificacao}`);
    
    // Enviar notificação por email/WhatsApp
    let notificacaoResult = null;
    
    if (enviarNotificacao) {
      console.log(`📤 Enviando notificação para ${candidato.email} / ${candidato.telefone}`);
      notificacaoResult = await enviarNotificacaoDocumentos({
        nome: candidato.nome,
        email: candidato.email,
        telefone: candidato.telefone,
        linkDocumentos,
        cpf,
        senha,
        vagaTitulo: candidato.vaga_titulo,
      });
      console.log(`📊 Resultado notificação:`, notificacaoResult);
    }
    
    console.log(`✅ Credenciais criadas com sucesso! CPF: ${cpf} | Senha: ${senha}`);
    
    res.json({
      success: true,
      link: linkDocumentos,
      cpf,
      senha,
      novoRegistro,
      candidato: {
        id: candidato.id,
        nome: candidato.nome,
        email: candidato.email,
      },
      notificacao: notificacaoResult,
    });
  } catch (error: any) {
    console.error('Erro ao gerar link de documentos:', error);
    res.status(500).json({ error: 'Erro ao gerar link' });
  }
});

/**
 * GET /documentos/:token
 * Busca informações do candidato via token (sem autenticação)
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    console.log(`📄 Buscando documentos para token: ${token}`);
    
    // Buscar registro de documentos
    const docResult = await pool.query(
      `SELECT 
        dc.*,
        c.nome as candidato_nome,
        c.email as candidato_email,
        c.telefone as candidato_telefone,
        c.cpf as candidato_cpf,
        v.titulo as vaga_titulo
       FROM documentos_candidatos dc
       JOIN candidatos c ON dc.candidato_id = c.id
       LEFT JOIN vagas v ON c.vaga_id = v.id
       WHERE dc.token_acesso = $1`,
      [token]
    );
    
    console.log(`📊 Resultado da busca: ${docResult.rows.length} registro(s) encontrado(s)`);
    
    if (docResult.rows.length === 0) {
      console.log(`❌ Token não encontrado: ${token}`);
      return res.status(404).json({ error: 'Link inválido ou expirado' });
    }
    
    const doc = docResult.rows[0];
    
    console.log(`✅ Documento encontrado para candidato: ${doc.candidato_nome}`);
    
    // Verificar se o token expirou
    if (doc.token_expira_em && new Date(doc.token_expira_em) < new Date()) {
      console.log(`❌ Token expirado: ${doc.token_expira_em}`);
      return res.status(400).json({ error: 'Link expirado. Entre em contato com o RH.' });
    }
    
    console.log(`✅ Enviando dados do candidato ${doc.candidato_nome}`);
    
    res.json({
      success: true,
      candidato: {
        nome: doc.candidato_nome,
        email: doc.candidato_email,
        telefone: doc.candidato_telefone,
        cpf: doc.candidato_cpf,
        vaga: doc.vaga_titulo,
      },
      documentos: {
        ctps_digital: {
          url: doc.ctps_digital_url,
          validado: doc.ctps_digital_validado,
          rejeitado: doc.ctps_digital_rejeitado,
          motivo_rejeicao: doc.ctps_digital_motivo_rejeicao,
        },
        identidade_frente: {
          url: doc.identidade_frente_url,
          validado: doc.identidade_frente_validado,
          rejeitado: doc.identidade_frente_rejeitado,
          motivo_rejeicao: doc.identidade_frente_motivo_rejeicao,
        },
        identidade_verso: {
          url: doc.identidade_verso_url,
          validado: doc.identidade_verso_validado,
          rejeitado: doc.identidade_verso_rejeitado,
          motivo_rejeicao: doc.identidade_verso_motivo_rejeicao,
        },
        comprovante_residencia: {
          url: doc.comprovante_residencia_url,
          validado: doc.comprovante_residencia_validado,
          rejeitado: doc.comprovante_residencia_rejeitado,
          motivo_rejeicao: doc.comprovante_residencia_motivo_rejeicao,
          data_emissao: doc.comprovante_residencia_data_emissao,
        },
        certidao_nascimento_casamento: {
          url: doc.certidao_nascimento_casamento_url,
          validado: doc.certidao_nascimento_casamento_validado,
          rejeitado: doc.certidao_nascimento_casamento_rejeitado,
          motivo_rejeicao: doc.certidao_nascimento_casamento_motivo_rejeicao,
        },
        reservista: {
          url: doc.reservista_url,
          validado: doc.reservista_validado,
          rejeitado: doc.reservista_rejeitado,
          motivo_rejeicao: doc.reservista_motivo_rejeicao,
        },
        titulo_eleitor: {
          url: doc.titulo_eleitor_url,
          validado: doc.titulo_eleitor_validado,
          rejeitado: doc.titulo_eleitor_rejeitado,
          motivo_rejeicao: doc.titulo_eleitor_motivo_rejeicao,
        },
        antecedentes_criminais: {
          url: doc.antecedentes_criminais_url,
          validado: doc.antecedentes_criminais_validado,
          rejeitado: doc.antecedentes_criminais_rejeitado,
          motivo_rejeicao: doc.antecedentes_criminais_motivo_rejeicao,
        },
        filhos_documentos: doc.filhos_documentos || [],
      },
      status: doc.status,
    });
  } catch (error: any) {
    console.error('Erro ao buscar documentos:', error);
    res.status(500).json({ error: 'Erro ao buscar documentos' });
  }
});

/**
 * POST /documentos/:token/upload
 * Upload de um documento específico
 */
router.post('/:token/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { tipo_documento } = req.body; // Ex: "ctps_digital", "identidade_frente", etc.
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const fileUrl = (req.file as any).path; // URL do Cloudinary
    
    console.log(`📤 Upload recebido: ${tipo_documento} - ${fileUrl}`);
    
    // Buscar registro de documentos
    const docResult = await pool.query(
      `SELECT dc.*, c.nome as candidato_nome
       FROM documentos_candidatos dc
       JOIN candidatos c ON dc.candidato_id = c.id
       WHERE dc.token_acesso = $1`,
      [token]
    );
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link inválido' });
    }
    
    const doc = docResult.rows[0];
    
    // 1. Validar qualidade da imagem
    console.log('🔍 Validando qualidade da imagem...');
    const qualidadeResult = await validarQualidadeImagem(fileUrl);
    
    if (!qualidadeResult.isValid) {
      console.log('❌ Imagem rejeitada por baixa qualidade:', qualidadeResult.issues);
      
      return res.status(400).json({
        error: 'Imagem rejeitada',
        motivo: qualidadeResult.issues.join(' '),
        detalhes: qualidadeResult.details,
      });
    }
    
    // 2. Detectar rasuras (opcional, pode deixar comentado se causar muitos falsos positivos)
    // const temRasuras = await detectarRasuras(fileUrl);
    // if (temRasuras) {
    //   return res.status(400).json({
    //     error: 'Documento parece estar rasurado ou com marcações. Envie uma foto limpa.',
    //   });
    // }
    
    // 3. Validação específica para comprovante de residência
    let dataEmissao = null;
    
    if (tipo_documento === 'comprovante_residencia') {
      console.log('📄 Validando comprovante de residência via OCR...');
      
      const comprovanteResult = await validarComprovanteResidencia(fileUrl, doc.candidato_nome);
      
      if (!comprovanteResult.isValid) {
        console.log('❌ Comprovante rejeitado:', comprovanteResult.issues);
        
        return res.status(400).json({
          error: 'Comprovante de residência inválido',
          motivo: comprovanteResult.issues.join(' '),
          dataEmissao: comprovanteResult.dataEmissao,
          diasAtras: comprovanteResult.diasAtras,
        });
      }
      
      dataEmissao = comprovanteResult.dataEmissao;
    }
    
    // 4. Salvar no banco
    const campoUrl = `${tipo_documento}_url`;
    const campoValidado = `${tipo_documento}_validado`;
    const campoRejeitado = `${tipo_documento}_rejeitado`;
    
    let updateQuery = `
      UPDATE documentos_candidatos 
      SET ${campoUrl} = $1,
          ${campoValidado} = false,
          ${campoRejeitado} = false,
          data_ultimo_upload = NOW()
    `;
    
    const params: any[] = [fileUrl];
    
    // Se não tiver primeiro upload, registrar
    if (!doc.data_primeiro_upload) {
      updateQuery += `, data_primeiro_upload = NOW()`;
    }
    
    // Se for comprovante de residência, salvar data de emissão
    if (tipo_documento === 'comprovante_residencia' && dataEmissao) {
      updateQuery += `, comprovante_residencia_data_emissao = $${params.length + 1}`;
      params.push(dataEmissao);
    }
    
    updateQuery += ` WHERE token_acesso = $${params.length + 1}`;
    params.push(token);
    
    await pool.query(updateQuery, params);
    
    console.log(`✅ Documento salvo: ${tipo_documento}`);
    
    res.json({
      success: true,
      message: 'Documento enviado com sucesso',
      url: fileUrl,
      qualidade: qualidadeResult,
      ...(dataEmissao && { dataEmissao }),
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload', detalhes: error.message });
  }
});

/**
 * POST /documentos/:token/filhos
 * Adicionar documentos de filhos
 */
router.post('/:token/filhos', upload.fields([
  { name: 'certidao', maxCount: 1 },
  { name: 'cpf', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { nome_filho, idade } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || !files.certidao) {
      return res.status(400).json({ error: 'Certidão de nascimento é obrigatória' });
    }
    
    const certidaoUrl = (files.certidao[0] as any).path;
    const cpfUrl = files.cpf ? (files.cpf[0] as any).path : null;
    
    // Buscar documentos
    const docResult = await pool.query(
      `SELECT filhos_documentos FROM documentos_candidatos WHERE token_acesso = $1`,
      [token]
    );
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link inválido' });
    }
    
    const filhosAtuais = docResult.rows[0].filhos_documentos || [];
    
    // Adicionar novo filho
    const novoFilho = {
      nome: nome_filho,
      idade: parseInt(idade),
      certidao_url: certidaoUrl,
      cpf_url: cpfUrl,
      data_upload: new Date().toISOString(),
    };
    
    filhosAtuais.push(novoFilho);
    
    // Atualizar banco
    await pool.query(
      `UPDATE documentos_candidatos 
       SET filhos_documentos = $1, data_ultimo_upload = NOW()
       WHERE token_acesso = $2`,
      [JSON.stringify(filhosAtuais), token]
    );
    
    res.json({
      success: true,
      message: 'Documentos do filho adicionados com sucesso',
      filho: novoFilho,
    });
  } catch (error: any) {
    console.error('Erro ao adicionar filho:', error);
    res.status(500).json({ error: 'Erro ao adicionar documentos do filho' });
  }
});

/**
 * GET /documentos/rh/listar
 * Lista todos os candidatos com documentos pendentes (RH)
 */
router.get('/rh/listar', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        dc.*,
        c.nome as candidato_nome,
        c.email as candidato_email,
        c.telefone as candidato_telefone,
        v.titulo as vaga_titulo
       FROM documentos_candidatos dc
       JOIN candidatos c ON dc.candidato_id = c.id
       LEFT JOIN vagas v ON c.vaga_id = v.id
       ORDER BY dc.data_envio_link DESC`
    );
    
    res.json({
      success: true,
      documentos: result.rows,
    });
  } catch (error: any) {
    console.error('Erro ao listar documentos:', error);
    res.status(500).json({ error: 'Erro ao listar documentos' });
  }
});

/**
 * PUT /documentos/rh/:id/validar
 * Validar ou rejeitar um documento específico (RH)
 */
router.put('/rh/:id/validar', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipo_documento, acao, motivo_rejeicao } = req.body; // acao: "aprovar" ou "rejeitar"
    
    const campoValidado = `${tipo_documento}_validado`;
    const campoRejeitado = `${tipo_documento}_rejeitado`;
    const campoMotivoRejeicao = `${tipo_documento}_motivo_rejeicao`;
    
    if (acao === 'aprovar') {
      await pool.query(
        `UPDATE documentos_candidatos 
         SET ${campoValidado} = true, ${campoRejeitado} = false, ${campoMotivoRejeicao} = NULL
         WHERE id = $1`,
        [id]
      );
    } else if (acao === 'rejeitar') {
      await pool.query(
        `UPDATE documentos_candidatos 
         SET ${campoValidado} = false, ${campoRejeitado} = true, ${campoMotivoRejeicao} = $1
         WHERE id = $2`,
        [motivo_rejeicao, id]
      );
    }
    
    res.json({
      success: true,
      message: acao === 'aprovar' ? 'Documento aprovado' : 'Documento rejeitado',
    });
  } catch (error: any) {
    console.error('Erro ao validar documento:', error);
    res.status(500).json({ error: 'Erro ao validar documento' });
  }
});

/**
 * PUT /documentos/rh/:id/validar-todos
 * Aprovar ou rejeitar TODOS os documentos de um candidato
 * Requer autenticação RH
 */
router.put('/rh/:id/validar-todos', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acao, motivo_rejeicao } = req.body; // acao: "aprovar" ou "rejeitar"
    
    console.log(`📋 Validando TODOS os documentos do registro ${id} - Ação: ${acao}`);
    
    // Lista de todos os tipos de documentos
    const tiposDocumentos = [
      'foto_3x4',
      'ctps_digital',
      'identidade_frente',
      'identidade_verso',
      'comprovante_residencia',
      'certidao_nascimento_casamento',
      'reservista',
      'titulo_eleitor',
      'antecedentes_criminais',
      'certidao_nascimento_dependente',
      'cpf_dependente',
    ];
    
    // Buscar documento para verificar quais campos têm URL
    const docResult = await pool.query(
      `SELECT * FROM documentos_candidatos WHERE id = $1`,
      [id]
    );
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    const doc = docResult.rows[0];
    let documentosAtualizados = 0;
    
    // Atualizar cada documento que tem URL
    for (const tipo of tiposDocumentos) {
      const urlKey = `${tipo}_url`;
      
      // Só atualizar se o documento foi enviado (tem URL)
      if (doc[urlKey]) {
        const campoValidado = `${tipo}_validado`;
        const campoRejeitado = `${tipo}_rejeitado`;
        const campoMotivoRejeicao = `${tipo}_motivo_rejeicao`;
        
        if (acao === 'aprovar') {
          await pool.query(
            `UPDATE documentos_candidatos 
             SET ${campoValidado} = true, ${campoRejeitado} = false, ${campoMotivoRejeicao} = NULL
             WHERE id = $1`,
            [id]
          );
        } else if (acao === 'rejeitar') {
          await pool.query(
            `UPDATE documentos_candidatos 
             SET ${campoValidado} = false, ${campoRejeitado} = true, ${campoMotivoRejeicao} = $1
             WHERE id = $2`,
            [motivo_rejeicao, id]
          );
        }
        
        documentosAtualizados++;
      }
    }
    
    // Atualizar status geral do registro
    const novoStatus = acao === 'aprovar' ? 'aprovado' : 'rejeitado';
    await pool.query(
      `UPDATE documentos_candidatos SET status = $1, updated_at = NOW() WHERE id = $2`,
      [novoStatus, id]
    );
    
    // Atualizar status do candidato também
    await pool.query(
      `UPDATE candidatos SET status = $1 WHERE id = $2`,
      [novoStatus === 'aprovado' ? 'documentos_aprovados' : 'documentos_rejeitados', doc.candidato_id]
    );
    
    // Se foi aprovado, copiar URLs dos documentos para a tabela candidatos (para envio ao FGS)
    if (acao === 'aprovar') {
      await copiarDocumentosParaCandidatos(doc.candidato_id);
    }
    
    console.log(`✅ ${documentosAtualizados} documentos ${acao === 'aprovar' ? 'aprovados' : 'rejeitados'}`);
    
    res.json({
      success: true,
      message: acao === 'aprovar' 
        ? `✅ Todos os ${documentosAtualizados} documentos foram aprovados!` 
        : `❌ Todos os ${documentosAtualizados} documentos foram rejeitados!`,
      documentosAtualizados,
      novoStatus,
    });
  } catch (error: any) {
    console.error('Erro ao validar todos os documentos:', error);
    res.status(500).json({ error: 'Erro ao validar documentos' });
  }
});

/**
 * Copia URLs dos documentos aprovados de documentos_candidatos para candidatos
 * Isso permite que o FGS receba todos os documentos quando o candidato for enviado
 */
async function copiarDocumentosParaCandidatos(candidatoId: number): Promise<void> {
  try {
    console.log(`📋 Copiando documentos aprovados para candidato ${candidatoId}...`);
    
    // Buscar URLs dos documentos
    const result = await pool.query(
      `SELECT 
        foto_3x4_url,
        ctps_digital_url,
        identidade_frente_url,
        identidade_verso_url,
        comprovante_residencia_url,
        titulo_eleitor_url,
        certidao_nascimento_casamento_url,
        reservista_url,
        antecedentes_criminais_url,
        certidao_nascimento_dependente_url,
        cpf_dependente_url
       FROM documentos_candidatos 
       WHERE candidato_id = $1`,
      [candidatoId]
    );
    
    if (result.rows.length === 0) {
      console.log(`⚠️ Nenhum documento encontrado para candidato ${candidatoId}`);
      return;
    }
    
    const docs = result.rows[0];
    
    // Atualizar tabela candidatos com as URLs dos documentos
    await pool.query(
      `UPDATE candidatos 
       SET 
         foto_url = $1,
         ctps_url = $2,
         rg_frente_url = $3,
         rg_verso_url = $4,
         comprovante_residencia_url = $5,
         titulo_eleitor_url = $6,
         certidao_nascimento_url = $7,
         reservista_url = $8,
         antecedentes_criminais_url = $9,
         certidao_dependente_url = $10,
         cpf_dependente_url = $11
       WHERE id = $12`,
      [
        docs.foto_3x4_url,
        docs.ctps_digital_url,
        docs.identidade_frente_url,
        docs.identidade_verso_url,
        docs.comprovante_residencia_url,
        docs.titulo_eleitor_url,
        docs.certidao_nascimento_casamento_url,
        docs.reservista_url,
        docs.antecedentes_criminais_url,
        docs.certidao_nascimento_dependente_url,
        docs.cpf_dependente_url,
        candidatoId,
      ]
    );
    
    console.log(`✅ Documentos copiados para candidato ${candidatoId} - Prontos para envio ao FGS`);
  } catch (error) {
    console.error(`❌ Erro ao copiar documentos para candidato ${candidatoId}:`, error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

/**
 * Gera hash SHA-256 único para verificação do documento
 */
function gerarHashVerificacao(candidatoId: number, cpf: string, raca: string, dataHora: string): string {
  const dados = `${candidatoId}|${cpf}|${raca}|${dataHora}|FG_SERVICES_SECRET`;
  return crypto.createHash('sha256').update(dados).digest('hex').substring(0, 16).toUpperCase();
}

/**
 * POST /documentos/autodeclaracao
 * Salva autodeclaração racial do candidato com dados de verificação
 * Público (após login com CPF/Senha)
 */
router.post('/autodeclaracao', async (req: Request, res: Response) => {
  try {
    const { raca, aceiteTermos } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Validar raça
    const racasValidas = ['branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarar'];
    if (!raca || !racasValidas.includes(raca)) {
      return res.status(400).json({ error: 'Raça/cor inválida' });
    }
    
    // Validar aceite dos termos
    if (!aceiteTermos) {
      return res.status(400).json({ error: 'É necessário aceitar os termos da declaração' });
    }
    
    console.log(`🌍 Salvando autodeclaração racial: ${raca}`);
    
    // Obter candidato da sessão
    const candidatoId = obterCandidatoIdDaSessao(token);
    
    if (!candidatoId) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    
    // Buscar dados do candidato
    const result = await pool.query(
      `SELECT c.id, c.nome, c.cpf, c.email FROM candidatos c WHERE c.id = $1`,
      [candidatoId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidato não encontrado' });
    }
    
    const candidato = result.rows[0];
    
    // Capturar dados de verificação
    const ip = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.socket.remoteAddress || 'IP não disponível';
    const userAgent = req.headers['user-agent'] || 'User Agent não disponível';
    const dataHora = new Date().toISOString();
    
    // Gerar hash único de verificação
    const hashVerificacao = gerarHashVerificacao(candidato.id, candidato.cpf || '', raca, dataHora);
    
    console.log(`🔐 Dados de verificação:`);
    console.log(`  - IP: ${ip}`);
    console.log(`  - User Agent: ${userAgent.substring(0, 50)}...`);
    console.log(`  - Hash: ${hashVerificacao}`);
    
    // Atualizar autodeclaração na tabela de documentos com dados de verificação
    await pool.query(
      `UPDATE documentos_candidatos 
       SET autodeclaracao_racial = $1, 
           autodeclaracao_data = NOW(),
           autodeclaracao_ip = $2,
           autodeclaracao_user_agent = $3,
           autodeclaracao_hash = $4,
           autodeclaracao_aceite_termos = true,
           autodeclaracao_aceite_data = NOW()
       WHERE candidato_id = $5`,
      [raca, ip, userAgent, hashVerificacao, candidato.id]
    );
    
    // Também salvar na tabela de candidatos
    await pool.query(
      `UPDATE candidatos 
       SET autodeclaracao_racial = $1
       WHERE id = $2`,
      [raca, candidato.id]
    );
    
    console.log(`✅ Autodeclaração salva para ${candidato.nome}: ${raca} | Hash: ${hashVerificacao}`);
    
    // Verificar se todos os documentos foram enviados
    const completude = await verificarCompletude(candidato.id);
    console.log(`📊 Completude após autodeclaração: ${completude.documentosEnviados.length}/${DOCUMENTOS_OBRIGATORIOS.length} documentos | Autodeclaração: ${completude.autodeclaracaoPreenchida}`);
    
    if (completude.completo) {
      console.log(`🎉 Candidato ${candidato.id} completou todos os documentos!`);
      
      // Atualizar status para "documentos_enviados"
      await pool.query(
        `UPDATE documentos_candidatos 
         SET status = 'documentos_enviados', data_conclusao = NOW()
         WHERE candidato_id = $1`,
        [candidato.id]
      );
      
      // Atualizar status do candidato
      await pool.query(
        `UPDATE candidatos SET status = 'documentos_enviados' WHERE id = $1`,
        [candidato.id]
      );
      
      // Notificar RH (assíncrono, não bloqueia a resposta)
      notificarRHDocumentosCompletos(candidato.id);
    }
    
    res.json({
      success: true,
      message: 'Autodeclaração racial salva com sucesso',
      raca,
      hashVerificacao, // Retornar hash para exibir ao candidato
      completude: {
        documentosEnviados: completude.documentosEnviados.length,
        documentosFaltantes: completude.documentosFaltantes,
        autodeclaracaoPreenchida: completude.autodeclaracaoPreenchida,
        completo: completude.completo,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao salvar autodeclaração:', error);
    res.status(500).json({ error: 'Erro ao salvar autodeclaração' });
  }
});

/**
 * GET /documentos/verificar-autodeclaracao/:hash
 * Verifica autenticidade de uma autodeclaração pelo código hash
 * Público (para verificação externa)
 */
router.get('/verificar-autodeclaracao/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    
    if (!hash || hash.length !== 16) {
      return res.status(400).json({ 
        valido: false, 
        error: 'Código de verificação inválido' 
      });
    }
    
    console.log(`🔍 Verificando autodeclaração com hash: ${hash}`);
    
    const result = await pool.query(
      `SELECT 
        dc.autodeclaracao_racial,
        dc.autodeclaracao_data,
        dc.autodeclaracao_ip,
        dc.autodeclaracao_aceite_termos,
        dc.autodeclaracao_aceite_data,
        c.nome,
        v.titulo as vaga
       FROM documentos_candidatos dc
       JOIN candidatos c ON dc.candidato_id = c.id
       LEFT JOIN vagas v ON c.vaga_id = v.id
       WHERE dc.autodeclaracao_hash = $1`,
      [hash.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ Hash não encontrado: ${hash}`);
      return res.json({ 
        valido: false, 
        message: 'Código de verificação não encontrado no sistema' 
      });
    }
    
    const dados = result.rows[0];
    
    const racaLabels: Record<string, string> = {
      branca: 'Branca',
      preta: 'Preta',
      parda: 'Parda',
      amarela: 'Amarela',
      indigena: 'Indígena',
      nao_declarar: 'Prefere não declarar',
    };
    
    console.log(`✅ Autodeclaração verificada para: ${dados.nome}`);
    
    res.json({
      valido: true,
      message: 'Autodeclaração verificada com sucesso',
      dados: {
        nome: dados.nome,
        vaga: dados.vaga || 'Não especificada',
        racaCor: racaLabels[dados.autodeclaracao_racial] || dados.autodeclaracao_racial,
        dataDeclaracao: dados.autodeclaracao_data,
        aceiteTermos: dados.autodeclaracao_aceite_termos,
        dataAceite: dados.autodeclaracao_aceite_data,
        // Não expor IP por questões de privacidade
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao verificar autodeclaração:', error);
    res.status(500).json({ error: 'Erro ao verificar autodeclaração' });
  }
});

export default router;

