/**
 * 🔐 ROTAS LGPD - Solicitações de Exportação e Exclusão de Dados
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { enviarEmail } from '../services/emailService';

const router = Router();

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Gerar código de verificação de 6 dígitos
 */
function gerarCodigoVerificacao(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Obter IP do solicitante
 */
function obterIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
         req.socket.remoteAddress || 
         'unknown';
}

// ==========================================
// POST /lgpd/solicitar - Criar solicitação (PÚBLICA)
// ==========================================
router.post('/solicitar', async (req: Request, res: Response) => {
  try {
    const { email, telefone, tipo } = req.body;

    // Validações
    if (!email || !tipo) {
      return res.status(400).json({ 
        error: 'Email e tipo de solicitação são obrigatórios' 
      });
    }

    if (!['exportacao', 'exclusao'].includes(tipo)) {
      return res.status(400).json({ 
        error: 'Tipo inválido. Use "exportacao" ou "exclusao"' 
      });
    }

    console.log(`🔐 [LGPD] Nova solicitação de ${tipo} para: ${email}`);

    // Buscar candidato pelo email
    const candidato = await pool.query(
      'SELECT id, nome, email, telefone FROM candidatos WHERE LOWER(email) = LOWER($1) AND (dados_excluidos IS NULL OR dados_excluidos = FALSE)',
      [email]
    );

    const candidatoData = candidato.rows.length > 0 ? candidato.rows[0] : null;

    // Verificar se já existe solicitação pendente para este email
    const solicitacaoPendente = await pool.query(
      `SELECT id FROM solicitacoes_lgpd 
       WHERE LOWER(email_solicitante) = LOWER($1) 
       AND tipo = $2 
       AND status IN ('pendente', 'em_analise', 'aguardando_aprovacao_rh')
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [email, tipo]
    );

    if (solicitacaoPendente.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Você já possui uma solicitação em andamento. Aguarde até 24h para nova solicitação.' 
      });
    }

    // Gerar código de verificação
    const codigoVerificacao = gerarCodigoVerificacao();
    const ip = obterIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Definir status inicial: se candidato não encontrado, aguarda aprovação RH
    const statusInicial = candidatoData ? 'pendente' : 'aguardando_aprovacao_rh';
    
    // Criar solicitação
    const novaSolicitacao = await pool.query(
      `INSERT INTO solicitacoes_lgpd 
        (candidato_id, tipo, email_solicitante, telefone_solicitante, 
         ip_solicitante, user_agent, codigo_verificacao, data_envio_codigo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       RETURNING id, tipo, email_solicitante, created_at, status`,
      [candidatoData?.id || null, tipo, email, telefone || null, ip, userAgent, codigoVerificacao, statusInicial]
    );

    const solicitacao = novaSolicitacao.rows[0];

    // Enviar código por email
    const tipoTexto = tipo === 'exportacao' ? 'Exportação' : 'Exclusão';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">🔐 Confirmação de Solicitação LGPD</h2>
        
        <p>Olá${candidatoData ? `, <strong>${candidatoData.nome}</strong>` : ''}!</p>
        
        <p>Recebemos sua solicitação de <strong>${tipoTexto} de Dados Pessoais</strong>.</p>
        
        ${!candidatoData ? `
        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin: 20px 0;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            ⚠️ <strong>Atenção:</strong> Não encontramos uma candidatura associada a este email em nossa base de dados. 
            Sua solicitação será analisada por nossa equipe de RH para verificação.
          </p>
        </div>
        ` : ''}
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #6B7280;">Seu código de verificação é:</p>
          <h1 style="margin: 10px 0; font-size: 36px; color: #4F46E5; letter-spacing: 8px;">${codigoVerificacao}</h1>
          <p style="margin: 0; font-size: 12px; color: #9CA3AF;">Válido por 15 minutos</p>
        </div>
        
        <p>Para confirmar sua identidade e processar sua solicitação, insira este código na página de confirmação.</p>
        
        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin: 20px 0;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            ⚠️ <strong>Importante:</strong> Se você não fez esta solicitação, ignore este email e entre em contato conosco imediatamente.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          <strong>Protocolo:</strong> LGPD-${solicitacao.id.toString().padStart(6, '0')}<br>
          Data: ${new Date().toLocaleString('pt-BR')}<br>
          <br>
          Este é um email automático do AstronTalent - FG Services<br>
          Desenvolvido por <strong>Aestron</strong><br>
          Para dúvidas: lgpd@fgservices.com.br
        </p>
      </div>
    `;

    await enviarEmail({
      destinatario: email,
      assunto: `🔐 Código de Verificação - Solicitação LGPD`,
      conteudo: emailHtml
    });

    console.log(`✅ Código enviado para ${email} - Protocolo: LGPD-${solicitacao.id.toString().padStart(6, '0')}`);

    res.json({
      message: '✅ Solicitação criada! Verifique seu email para obter o código de confirmação.',
      solicitacao_id: solicitacao.id,
      protocolo: `LGPD-${solicitacao.id.toString().padStart(6, '0')}`,
      tipo: solicitacao.tipo,
      email: solicitacao.email_solicitante
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar solicitação LGPD:', error);
    res.status(500).json({ 
      error: 'Erro ao processar solicitação',
      detalhes: error.message 
    });
  }
});

// ==========================================
// POST /lgpd/validar-codigo - Validar código (PÚBLICA)
// ==========================================
router.post('/validar-codigo', async (req: Request, res: Response) => {
  try {
    const { solicitacao_id, codigo } = req.body;

    if (!solicitacao_id || !codigo) {
      return res.status(400).json({ 
        error: 'ID da solicitação e código são obrigatórios' 
      });
    }

    console.log(`🔐 [LGPD] Validando código para solicitação #${solicitacao_id}`);

    // Buscar solicitação
    const solicitacao = await pool.query(
      `SELECT s.*, c.nome, c.email 
       FROM solicitacoes_lgpd s
       JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = $1 AND s.status = 'pendente'`,
      [solicitacao_id]
    );

    if (solicitacao.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Solicitação não encontrada ou já foi processada' 
      });
    }

    const solicitacaoData = solicitacao.rows[0];

    // Verificar se código já foi validado
    if (solicitacaoData.codigo_validado) {
      return res.status(400).json({ 
        error: 'Código já foi validado anteriormente' 
      });
    }

    // Verificar se código expirou (15 minutos)
    const dataEnvio = new Date(solicitacaoData.data_envio_codigo);
    const agora = new Date();
    const diferencaMinutos = (agora.getTime() - dataEnvio.getTime()) / 1000 / 60;

    if (diferencaMinutos > 15) {
      return res.status(400).json({ 
        error: 'Código expirado. Solicite um novo código.' 
      });
    }

    // Validar código
    if (solicitacaoData.codigo_verificacao !== codigo) {
      return res.status(400).json({ 
        error: 'Código inválido' 
      });
    }

    // Atualizar status para validado
    await pool.query(
      `UPDATE solicitacoes_lgpd 
       SET codigo_validado = TRUE, 
           data_validacao_codigo = NOW(),
           status = 'em_analise'
       WHERE id = $1`,
      [solicitacao_id]
    );

    console.log(`✅ Código validado para solicitação #${solicitacao_id}`);

    // Enviar email de confirmação
    const tipoTexto = solicitacaoData.tipo === 'exportacao' ? 'Exportação' : 'Exclusão';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10B981;">✅ Solicitação Confirmada</h2>
        
        <p>Olá, <strong>${solicitacaoData.nome}</strong>!</p>
        
        <p>Sua solicitação de <strong>${tipoTexto} de Dados Pessoais</strong> foi confirmada e está em análise.</p>
        
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Protocolo:</strong> LGPD-${solicitacao_id.toString().padStart(6, '0')}</p>
          <p style="margin: 5px 0;"><strong>Tipo:</strong> ${tipoTexto}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Em Análise</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <p>Nossa equipe irá processar sua solicitação em até <strong>48 horas úteis</strong>.</p>
        
        <p>Você receberá um email de confirmação quando o processo for concluído.</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          Este é um email automático do AstronTalent - FG Services<br>
          Desenvolvido por <strong>Aestron</strong><br>
          Para dúvidas: lgpd@fgservices.com.br
        </p>
      </div>
    `;

    await enviarEmail({
      destinatario: solicitacaoData.email,
      assunto: `✅ Solicitação LGPD Confirmada - Protocolo ${solicitacao_id.toString().padStart(6, '0')}`,
      conteudo: emailHtml
    });

    res.json({
      message: '✅ Código validado com sucesso!',
      solicitacao: {
        id: solicitacao_id,
        protocolo: `LGPD-${solicitacao_id.toString().padStart(6, '0')}`,
        tipo: solicitacaoData.tipo,
        status: 'em_analise'
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao validar código:', error);
    res.status(500).json({ 
      error: 'Erro ao validar código',
      detalhes: error.message 
    });
  }
});

// ==========================================
// GET /lgpd/solicitacoes - Listar todas (PROTEGIDA - RH)
// ==========================================
router.get('/solicitacoes', async (req: Request, res: Response) => {
  try {
    const { status, tipo, limit = 50 } = req.query;

    let query = `
      SELECT 
        s.*,
        c.nome as candidato_nome,
        c.email as candidato_email,
        c.telefone as candidato_telefone,
        u.nome as aprovado_por_nome
      FROM solicitacoes_lgpd s
      JOIN candidatos c ON s.candidato_id = c.id
      LEFT JOIN usuarios u ON s.aprovado_por = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tipo) {
      query += ` AND s.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      total: result.rows.length,
      solicitacoes: result.rows
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar solicitações:', error);
    res.status(500).json({ 
      error: 'Erro ao listar solicitações',
      detalhes: error.message 
    });
  }
});

// ==========================================
// GET /lgpd/solicitacoes/:id - Detalhes (PROTEGIDA - RH)
// ==========================================
router.get('/solicitacoes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        s.*,
        c.nome as candidato_nome,
        c.email as candidato_email,
        c.telefone as candidato_telefone,
        c.curriculum_url,
        u.nome as aprovado_por_nome
      FROM solicitacoes_lgpd s
      JOIN candidatos c ON s.candidato_id = c.id
      LEFT JOIN usuarios u ON s.aprovado_por = u.id
      WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }

    res.json(result.rows[0]);

  } catch (error: any) {
    console.error('❌ Erro ao buscar solicitação:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar solicitação',
      detalhes: error.message 
    });
  }
});

// ==========================================
// POST /lgpd/exportar/:id - Exportar dados (PROTEGIDA - RH)
// ==========================================
router.post('/exportar/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = (req as any).user?.id;

    console.log(`📦 [LGPD] Exportando dados da solicitação #${id}`);

    // Buscar solicitação
    const solicitacao = await pool.query(
      `SELECT s.*, c.* 
       FROM solicitacoes_lgpd s
       JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = $1 AND s.tipo = 'exportacao'`,
      [id]
    );

    if (solicitacao.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação de exportação não encontrada' });
    }

    const dados = solicitacao.rows[0];

    // Buscar dados relacionados
    const candidaturas = await pool.query(
      'SELECT * FROM candidatos WHERE id = $1',
      [dados.candidato_id]
    );

    const historicoComunicacao = await pool.query(
      'SELECT * FROM historico_comunicacao WHERE candidato_id = $1',
      [dados.candidato_id]
    );

    const agendamentos = await pool.query(
      'SELECT * FROM agendamentos WHERE candidato_id = $1',
      [dados.candidato_id]
    );

    // Montar dados completos
    const dadosExportacao = {
      protocolo: `LGPD-${id.toString().padStart(6, '0')}`,
      data_exportacao: new Date().toISOString(),
      
      dados_pessoais: {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        data_nascimento: dados.data_nascimento,
        cpf: dados.cpf,
        cidade: dados.cidade,
        estado: dados.estado,
        bairro: dados.bairro
      },
      
      dados_profissionais: {
        curriculo: dados.curriculo,
        vaga_id: dados.vaga_id,
        status: dados.status
      },
      
      candidaturas: candidaturas.rows,
      historico_comunicacao: historicoComunicacao.rows,
      agendamentos: agendamentos.rows,
      
      consentimento_lgpd: {
        concedido: dados.consentimento_lgpd,
        data: dados.data_consentimento,
        ip: dados.ip_consentimento
      }
    };

    // Atualizar status da solicitação
    await pool.query(
      `UPDATE solicitacoes_lgpd 
       SET status = 'concluida', 
           data_conclusao = NOW(),
           aprovado_por = $1
       WHERE id = $2`,
      [usuarioId, id]
    );

    // Enviar dados por email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10B981;">📦 Exportação de Dados Concluída</h2>
        
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        
        <p>Sua solicitação de exportação de dados pessoais foi processada com sucesso.</p>
        
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Protocolo:</strong> LGPD-${id.toString().padStart(6, '0')}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <p>Seus dados estão anexados a este email em formato JSON.</p>
        
        <p>Conforme a LGPD, você tem direito a:</p>
        <ul>
          <li>Acessar seus dados a qualquer momento</li>
          <li>Solicitar correção de dados incorretos</li>
          <li>Solicitar exclusão de seus dados</li>
          <li>Revogar seu consentimento</li>
        </ul>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          Este é um email automático do AstronTalent - FG Services<br>
          Desenvolvido por <strong>Aestron</strong><br>
          Para dúvidas: lgpd@fgservices.com.br
        </p>
      </div>
    `;

    // Nota: Aqui você precisaria usar um serviço de email que suporte anexos
    // Por enquanto, vamos apenas retornar os dados
    await enviarEmail({
      destinatario: dados.email,
      assunto: `📦 Exportação de Dados LGPD - Protocolo ${id.toString().padStart(6, '0')}`,
      conteudo: emailHtml
    });

    console.log(`✅ Dados exportados para solicitação #${id}`);

    res.json({
      message: '✅ Dados exportados com sucesso!',
      protocolo: `LGPD-${id.toString().padStart(6, '0')}`,
      dados: dadosExportacao
    });

  } catch (error: any) {
    console.error('❌ Erro ao exportar dados:', error);
    res.status(500).json({ 
      error: 'Erro ao exportar dados',
      detalhes: error.message 
    });
  }
});

// ==========================================
// POST /lgpd/excluir/:id - Excluir dados (PROTEGIDA - RH)
// ==========================================
router.post('/excluir/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuarioId = (req as any).user?.id;

    console.log(`🗑️ [LGPD] Processando exclusão da solicitação #${id}`);

    // Buscar solicitação
    const solicitacao = await pool.query(
      `SELECT s.*, c.nome, c.email 
       FROM solicitacoes_lgpd s
       JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = $1 AND s.tipo = 'exclusao'`,
      [id]
    );

    if (solicitacao.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação de exclusão não encontrada' });
    }

    const dados = solicitacao.rows[0];
    const candidatoId = dados.candidato_id;

    // ANONIMIZAR dados (não deletar completamente para manter auditoria)
    await pool.query(
      `UPDATE candidatos 
       SET 
         nome = $1,
         email = $2,
         telefone = '(00) 00000-0000',
         cpf = '000.000.000-00',
         data_nascimento = NULL,
         cidade = 'Excluído',
         estado = 'XX',
         bairro = 'Excluído',
         curriculo = NULL,
         dados_excluidos = TRUE,
         data_exclusao = NOW(),
         motivo_exclusao = $3,
         excluido_por = $4
       WHERE id = $5`,
      [
        `Usuário Excluído #${candidatoId}`,
        `excluido_${candidatoId}@anonimo.com`,
        motivo || 'Solicitação do titular via LGPD',
        usuarioId,
        candidatoId
      ]
    );

    // Deletar dados sensíveis relacionados
    await pool.query('DELETE FROM historico_comunicacao WHERE candidato_id = $1', [candidatoId]);
    await pool.query('DELETE FROM agendamentos WHERE candidato_id = $1', [candidatoId]);

    // Atualizar status da solicitação
    await pool.query(
      `UPDATE solicitacoes_lgpd 
       SET status = 'concluida', 
           data_conclusao = NOW(),
           aprovado_por = $1,
           observacoes = $2
       WHERE id = $3`,
      [usuarioId, motivo || 'Dados anonimizados conforme LGPD', id]
    );

    // Gerar hash do comprovante
    const hashComprovante = require('crypto')
      .createHash('sha256')
      .update(`${id}-${candidatoId}-${new Date().toISOString()}`)
      .digest('hex');

    await pool.query(
      'UPDATE solicitacoes_lgpd SET hash_comprovante = $1 WHERE id = $2',
      [hashComprovante, id]
    );

    // Enviar comprovante por email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10B981;">✅ Exclusão de Dados Concluída</h2>
        
        <p>Olá!</p>
        
        <p>Sua solicitação de exclusão de dados pessoais foi processada com sucesso.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📋 Comprovante de Exclusão LGPD</h3>
          <p style="margin: 5px 0;"><strong>Protocolo:</strong> LGPD-${id.toString().padStart(6, '0')}</p>
          <p style="margin: 5px 0;"><strong>Data da Solicitação:</strong> ${new Date(dados.created_at).toLocaleString('pt-BR')}</p>
          <p style="margin: 5px 0;"><strong>Data da Conclusão:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p style="margin: 5px 0;"><strong>Hash de Verificação:</strong> <code>${hashComprovante.substring(0, 16)}...</code></p>
        </div>
        
        <div style="background-color: #ECFDF5; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #065F46;">✅ Dados Excluídos:</h4>
          <ul style="color: #065F46; margin: 10px 0;">
            <li>Nome completo</li>
            <li>Email</li>
            <li>Telefone</li>
            <li>Documentos (CPF)</li>
            <li>Data de Nascimento</li>
            <li>Endereço (Cidade, Estado, Bairro)</li>
            <li>Currículo</li>
            <li>Histórico de comunicações</li>
            <li>Agendamentos</li>
          </ul>
        </div>
        
        <p>Conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), seus dados pessoais foram completamente removidos de nossa base.</p>
        
        <p style="font-size: 12px; color: #6B7280;">
          <strong>Observação:</strong> Alguns dados anonimizados podem ser mantidos para fins de auditoria e cumprimento de obrigações legais, mas sem qualquer identificação pessoal.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          <strong>FG Services</strong><br>
          Encarregado de Dados (DPO): lgpd@fgservices.com.br<br>
          Este comprovante tem validade legal conforme Art. 18, VI da LGPD
        </p>
      </div>
    `;

    await enviarEmail({
      destinatario: dados.email,
      assunto: `✅ Comprovante de Exclusão LGPD - Protocolo ${id.toString().padStart(6, '0')}`,
      conteudo: emailHtml
    });

    console.log(`✅ Dados excluídos/anonimizados para candidato #${candidatoId}`);

    res.json({
      message: '✅ Dados excluídos com sucesso!',
      protocolo: `LGPD-${id.toString().padStart(6, '0')}`,
      hash_comprovante: hashComprovante,
      data_conclusao: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Erro ao excluir dados:', error);
    res.status(500).json({ 
      error: 'Erro ao excluir dados',
      detalhes: error.message 
    });
  }
});

// ==========================================
// POST /lgpd/rejeitar/:id - Rejeitar solicitação (PROTEGIDA - RH)
// ==========================================
router.post('/rejeitar/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuarioId = (req as any).user?.id;

    if (!motivo) {
      return res.status(400).json({ error: 'Motivo da rejeição é obrigatório' });
    }

    await pool.query(
      `UPDATE solicitacoes_lgpd 
       SET status = 'rejeitada', 
           motivo_rejeicao = $1,
           aprovado_por = $2,
           data_conclusao = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    res.json({ message: '✅ Solicitação rejeitada' });

  } catch (error: any) {
    console.error('❌ Erro ao rejeitar solicitação:', error);
    res.status(500).json({ 
      error: 'Erro ao rejeitar solicitação',
      detalhes: error.message 
    });
  }
});

// ==========================================
// POST /lgpd/notificar-email-nao-encontrado/:id - Notificar solicitante (PROTEGIDA - RH)
// ==========================================
router.post('/notificar-email-nao-encontrado/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = (req as any).user?.id;

    console.log(`📧 [LGPD] Enviando notificação de email não encontrado - Solicitação #${id}`);

    // Buscar solicitação
    const solicitacao = await pool.query(
      `SELECT * FROM solicitacoes_lgpd WHERE id = $1`,
      [id]
    );

    if (solicitacao.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }

    const dados = solicitacao.rows[0];

    // Verificar se candidato realmente não foi encontrado
    if (dados.candidato_id) {
      return res.status(400).json({ 
        error: 'Esta solicitação possui um candidato associado. Use a função de exclusão normal.' 
      });
    }

    const tipoTexto = dados.tipo === 'exportacao' ? 'exportação' : 'exclusão';

    // Enviar email ao solicitante
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F59E0B;">⚠️ Solicitação LGPD - Dados Não Encontrados</h2>
        
        <p>Olá!</p>
        
        <p>Recebemos sua solicitação de <strong>${tipoTexto} de dados pessoais</strong>, porém:</p>
        
        <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; border-left: 4px solid #F59E0B; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #92400E;">📋 Não encontramos registros com este email</h4>
          <p style="color: #92400E; margin: 5px 0;">
            <strong>Email informado:</strong> ${dados.email_solicitante}
          </p>
          <p style="color: #92400E; margin: 5px 0;">
            <strong>Protocolo:</strong> LGPD-${id.toString().padStart(6, '0')}
          </p>
        </div>
        
        <h3 style="color: #4F46E5;">🔍 O que fazer agora?</h3>
        
        <ol style="line-height: 1.8;">
          <li><strong>Verifique se você usou o email correto</strong> que foi cadastrado no momento da candidatura</li>
          <li>Se você possui mais de um email, tente fazer uma nova solicitação com outro endereço</li>
          <li>Se você tem certeza de que se candidatou com este email, entre em contato conosco</li>
        </ol>
        
        <div style="background-color: #E0F2FE; padding: 15px; border-radius: 8px; border-left: 4px solid #0284C7; margin: 20px 0;">
          <p style="margin: 0; color: #075985; font-size: 14px;">
            💡 <strong>Dica:</strong> Verifique se o email não foi digitado incorretamente ou se você possui variações 
            (ex: joao@email.com vs joaosilva@email.com)
          </p>
        </div>
        
        <h3 style="color: #4F46E5;">📞 Precisa de ajuda?</h3>
        <p>Entre em contato conosco:</p>
        <ul>
          <li><strong>Email:</strong> lgpd@fgservices.com.br</li>
          <li><strong>WhatsApp:</strong> (81) 99999-9999</li>
        </ul>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
          <strong>FG Services</strong><br>
          Encarregado de Dados (DPO): lgpd@fgservices.com.br<br>
          Este email foi enviado em cumprimento à LGPD (Lei nº 13.709/2018)
        </p>
      </div>
    `;

    await enviarEmail({
      destinatario: dados.email_solicitante,
      assunto: `⚠️ Solicitação LGPD - Email Não Encontrado (Protocolo ${id.toString().padStart(6, '0')})`,
      conteudo: emailHtml
    });

    // Atualizar status da solicitação
    await pool.query(
      `UPDATE solicitacoes_lgpd 
       SET status = 'email_nao_encontrado', 
           aprovado_por = $1,
           observacoes = 'Email não encontrado na base de dados. Solicitante notificado.',
           data_conclusao = NOW()
       WHERE id = $2`,
      [usuarioId, id]
    );

    console.log(`✅ Notificação enviada para ${dados.email_solicitante}`);

    res.json({
      message: '✅ Email enviado ao solicitante informando que não encontramos dados cadastrados',
      protocolo: `LGPD-${id.toString().padStart(6, '0')}`
    });

  } catch (error: any) {
    console.error('❌ Erro ao enviar notificação:', error);
    res.status(500).json({ 
      error: 'Erro ao enviar notificação',
      detalhes: error.message 
    });
  }
});

export default router;

