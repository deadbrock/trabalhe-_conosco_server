import { Router, Request, Response } from "express";
import { 
  iniciarWhatsApp, 
  verificarConexao, 
  desconectarWhatsApp, 
  obterQRCode,
  buscarQRCodeDoBanco,
  enviarWhatsApp
} from "../services/whatsappService";

const router = Router();

// GET /whatsapp/status - Verificar status da conexão
router.get("/status", async (req: Request, res: Response) => {
  try {
    const conectado = await verificarConexao();
    
    res.json({
      conectado,
      status: conectado ? 'connected' : 'disconnected'
    });
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    res.status(500).json({ error: "Erro ao verificar status" });
  }
});

// GET /whatsapp/qrcode - Obter QR Code para conectar
router.get("/qrcode", async (req: Request, res: Response) => {
  try {
    // Primeiro tentar obter QR Code da memória
    let qrcode = obterQRCode();
    
    // Se não tiver em memória, buscar do banco
    if (!qrcode) {
      qrcode = await buscarQRCodeDoBanco();
    }
    
    // Se ainda não tiver, iniciar nova conexão
    if (!qrcode) {
      console.log('📱 Iniciando nova conexão do WhatsApp...');
      await iniciarWhatsApp();
      
      // Aguardar alguns segundos para o QR Code ser gerado
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      qrcode = obterQRCode();
      
      if (!qrcode) {
        qrcode = await buscarQRCodeDoBanco();
      }
    }
    
    if (qrcode) {
      res.json({
        qrcode,
        message: 'Escaneie o QR Code com o WhatsApp'
      });
    } else {
      res.status(503).json({
        error: 'QR Code ainda não gerado',
        message: 'Aguarde alguns segundos e tente novamente'
      });
    }
  } catch (error: any) {
    console.error("Erro ao obter QR Code:", error);
    res.status(500).json({ 
      error: "Erro ao obter QR Code",
      message: error.message 
    });
  }
});

// POST /whatsapp/iniciar - Forçar inicialização
router.post("/iniciar", async (req: Request, res: Response) => {
  try {
    await iniciarWhatsApp();
    
    res.json({
      message: 'WhatsApp iniciado com sucesso',
      status: 'starting'
    });
  } catch (error: any) {
    console.error("Erro ao iniciar WhatsApp:", error);
    res.status(500).json({ 
      error: "Erro ao iniciar WhatsApp",
      message: error.message 
    });
  }
});

// POST /whatsapp/desconectar - Desconectar WhatsApp
router.post("/desconectar", async (req: Request, res: Response) => {
  try {
    await desconectarWhatsApp();
    
    res.json({
      message: 'WhatsApp desconectado com sucesso'
    });
  } catch (error) {
    console.error("Erro ao desconectar WhatsApp:", error);
    res.status(500).json({ error: "Erro ao desconectar WhatsApp" });
  }
});

// POST /whatsapp/testar - Enviar mensagem de teste
router.post("/testar", async (req: Request, res: Response) => {
  try {
    const { numero, mensagem } = req.body;
    
    if (!numero || !mensagem) {
      return res.status(400).json({ 
        error: 'Número e mensagem são obrigatórios' 
      });
    }
    
    const resultado = await enviarWhatsApp({ numero, mensagem });
    
    if (resultado.sucesso) {
      res.json({
        message: 'Mensagem enviada com sucesso',
        messageId: resultado.messageId
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

export default router;

