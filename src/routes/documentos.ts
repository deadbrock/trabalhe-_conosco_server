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
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
      transformation: [{ quality: 'auto:good' }],
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
    
    console.log(`✅ Login bem-sucedido - Candidato: ${credencial.nome}`);
    
    // Gerar token JWT para a sessão
    const token = crypto.randomBytes(32).toString('hex');
    
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
      await pool.query(
        `INSERT INTO documentos_candidatos (candidato_id, token_acesso, token_expira_em)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [candidatoId, cpf, cpf] // Usar CPF como placeholder
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
         WHERE id = $1`,
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

export default router;

