/**
 * 📱 Rotas de WhatsApp (Twilio)
 */

import { Router, Request, Response } from 'express';
import {
  enviarWhatsApp,
  verificarConexao,
  obterInfoConta,
  obterSaldo,
  buscarHistoricoMensagens,
  validarNumero,
  formatarNumero
} from '../services/whatsappService';

const router = Router();

/**
 * GET /whatsapp/status
 * Verifica status da conexão com Twilio
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const conectado = await verificarConexao();
    
    let info: any = {
      conectado,
      status: conectado ? 'connected' : 'disconnected',
      tipo: 'Twilio WhatsApp API'
    };

    // Se conectado, buscar informações da conta
    if (conectado) {
      try {
        const conta = await obterInfoConta();
        const saldo = await obterSaldo();
        
        info = {
          ...info,
          conta: conta.nome,
          saldo,
          numero: process.env.TWILIO_WHATSAPP_NUMBER
        };
      } catch (err) {
        console.error('Erro ao buscar informações da conta:', err);
      }
    }

    res.json(info);
  } catch (error: any) {
    console.error("Erro ao verificar status:", error);
    res.status(500).json({ 
      error: "Erro ao verificar status",
      message: error.message 
    });
  }
});

/**
 * POST /whatsapp/testar
 * Envia mensagem de teste
 */
router.post("/testar", async (req: Request, res: Response) => {
  try {
    const { numero, mensagem } = req.body;
    
    if (!numero || !mensagem) {
      return res.status(400).json({ 
        error: 'Número e mensagem são obrigatórios' 
      });
    }

    // Validar número
    if (!validarNumero(numero)) {
      return res.status(400).json({
        error: 'Número de telefone inválido',
        message: 'Use o formato: (11) 99999-9999 ou 11999999999'
      });
    }
    
    console.log(`📤 Teste de envio para ${numero}: ${mensagem.substring(0, 30)}...`);
    
    const resultado = await enviarWhatsApp({ numero, mensagem });
    
    if (resultado.sucesso) {
      res.json({
        message: 'Mensagem enviada com sucesso via Twilio!',
        messageId: resultado.messageId,
        para: formatarNumero(numero),
        status: 'sent'
      });
    } else {
      res.status(500).json({
        error: 'Falha ao enviar mensagem',
        detalhes: resultado.erro
      });
    }
  } catch (error: any) {
    console.error("Erro ao enviar mensagem de teste:", error);
    res.status(500).json({ 
      error: "Erro ao enviar mensagem",
      message: error.message 
    });
  }
});

/**
 * GET /whatsapp/historico
 * Busca histórico de mensagens enviadas
 */
router.get("/historico", async (req: Request, res: Response) => {
  try {
    const limite = parseInt(req.query.limite as string) || 20;
    
    const historico = await buscarHistoricoMensagens(limite);
    
    res.json({
      total: historico.length,
      mensagens: historico
    });
  } catch (error: any) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ 
      error: "Erro ao buscar histórico",
      message: error.message 
    });
  }
});

/**
 * GET /whatsapp/saldo
 * Obtém saldo da conta Twilio
 */
router.get("/saldo", async (req: Request, res: Response) => {
  try {
    const saldo = await obterSaldo();
    
    res.json({
      saldo,
      message: 'Saldo disponível na conta Twilio'
    });
  } catch (error: any) {
    console.error("Erro ao obter saldo:", error);
    res.status(500).json({ 
      error: "Erro ao obter saldo",
      message: error.message 
    });
  }
});

/**
 * GET /whatsapp/info
 * Obtém informações da conta Twilio
 */
router.get("/info", async (req: Request, res: Response) => {
  try {
    const info = await obterInfoConta();
    
    res.json(info);
  } catch (error: any) {
    console.error("Erro ao obter info da conta:", error);
    res.status(500).json({ 
      error: "Erro ao obter informações da conta",
      message: error.message 
    });
  }
});

/**
 * POST /whatsapp/validar-numero
 * Valida formato de número de telefone
 */
router.post("/validar-numero", (req: Request, res: Response) => {
  try {
    const { numero } = req.body;
    
    if (!numero) {
      return res.status(400).json({ 
        error: 'Número é obrigatório' 
      });
    }

    const valido = validarNumero(numero);
    const formatado = valido ? formatarNumero(numero) : null;
    
    res.json({
      valido,
      numero_original: numero,
      numero_formatado: formatado,
      message: valido 
        ? 'Número válido' 
        : 'Número inválido. Use o formato: (11) 99999-9999'
    });
  } catch (error: any) {
    console.error("Erro ao validar número:", error);
    res.status(500).json({ 
      error: "Erro ao validar número",
      message: error.message 
    });
  }
});

export default router;
