/**
 * 📱 Serviço de WhatsApp usando Twilio API
 * 
 * Vantagens:
 * - ✅ API oficial autorizada pelo WhatsApp
 * - ✅ Sem Chromium/Puppeteer (leve)
 * - ✅ Sem QR Code (conecta automaticamente)
 * - ✅ Funciona em qualquer plataforma (Railway, Vercel, etc.)
 * - ✅ 99.9% de uptime
 * - ✅ Escalável (milhões de mensagens)
 */

import twilio from 'twilio';

// Validar variáveis de ambiente
if (!process.env.TWILIO_ACCOUNT_SID) {
  console.warn('⚠️  TWILIO_ACCOUNT_SID não configurado');
}
if (!process.env.TWILIO_AUTH_TOKEN) {
  console.warn('⚠️  TWILIO_AUTH_TOKEN não configurado');
}
if (!process.env.TWILIO_WHATSAPP_NUMBER) {
  console.warn('⚠️  TWILIO_WHATSAPP_NUMBER não configurado (use: whatsapp:+14155238886 para sandbox)');
}

// Cliente Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

interface EnviarWhatsAppParams {
  numero: string;
  mensagem: string;
}

interface ResultadoEnvio {
  sucesso: boolean;
  messageId?: string;
  erro?: string;
}

/**
 * Envia mensagem via WhatsApp usando Twilio
 */
export async function enviarWhatsApp({
  numero,
  mensagem
}: EnviarWhatsAppParams): Promise<ResultadoEnvio> {
  try {
    // Validar configuração
    if (!twilioClient) {
      console.error('❌ Twilio não configurado. Adicione as variáveis de ambiente.');
      return {
        sucesso: false,
        erro: 'Twilio não configurado. Verifique TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN.'
      };
    }

    if (!process.env.TWILIO_WHATSAPP_NUMBER) {
      console.error('❌ TWILIO_WHATSAPP_NUMBER não configurado.');
      return {
        sucesso: false,
        erro: 'Número do WhatsApp não configurado.'
      };
    }

    // Limpar e formatar número
    const numeroLimpo = numero.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    const numeroFormatado = numeroLimpo.startsWith('55') 
      ? numeroLimpo 
      : `55${numeroLimpo}`;

    // Formato do Twilio: whatsapp:+5511999999999
    const numeroCompleto = `whatsapp:+${numeroFormatado}`;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    console.log(`📤 Enviando WhatsApp via Twilio para: ${numeroCompleto}`);
    console.log(`📤 De: ${from}`);

    // Enviar mensagem
    const message = await twilioClient.messages.create({
      body: mensagem,
      from: from,
      to: numeroCompleto
    });

    console.log(`✅ WhatsApp enviado com sucesso! SID: ${message.sid}`);
    console.log(`📊 Status: ${message.status}`);

    return {
      sucesso: true,
      messageId: message.sid
    };

  } catch (error: any) {
    console.error('❌ Erro ao enviar WhatsApp via Twilio:', error.message);
    
    // Mensagens de erro mais amigáveis
    let mensagemErro = error.message || 'Erro desconhecido ao enviar WhatsApp';
    
    if (error.code === 21608) {
      mensagemErro = 'Número não tem WhatsApp ou não aceitou o sandbox. Envie o código de ativação primeiro.';
    } else if (error.code === 21211) {
      mensagemErro = 'Número de telefone inválido.';
    } else if (error.code === 20003) {
      mensagemErro = 'Credenciais Twilio inválidas. Verifique ACCOUNT_SID e AUTH_TOKEN.';
    }

    return {
      sucesso: false,
      erro: mensagemErro
    };
  }
}

/**
 * Verifica se o WhatsApp está configurado e funcionando
 */
export async function verificarConexao(): Promise<boolean> {
  try {
    if (!twilioClient) {
      console.log('⚠️  Twilio não configurado');
      return false;
    }

    // Testar conexão buscando a conta
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const account = await twilioClient.api.accounts(accountSid).fetch();
    
    console.log(`✅ Twilio conectado! Conta: ${account.friendlyName}`);
    console.log(`📊 Status: ${account.status}`);
    
    return account.status === 'active';
  } catch (error: any) {
    console.error('❌ Erro ao verificar conexão Twilio:', error.message);
    return false;
  }
}

/**
 * Obtém informações da conta Twilio
 */
export async function obterInfoConta(): Promise<any> {
  try {
    if (!twilioClient) {
      throw new Error('Twilio não configurado');
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const account = await twilioClient.api.accounts(accountSid).fetch();
    
    return {
      nome: account.friendlyName,
      status: account.status,
      tipo: account.type,
      criado_em: account.dateCreated
    };
  } catch (error: any) {
    console.error('❌ Erro ao obter info da conta:', error.message);
    throw error;
  }
}

/**
 * Obtém saldo da conta Twilio
 */
export async function obterSaldo(): Promise<string> {
  try {
    if (!twilioClient) {
      throw new Error('Twilio não configurado');
    }

    const balance = await twilioClient.balance.fetch();
    
    return `${balance.currency} ${balance.balance}`;
  } catch (error: any) {
    console.error('❌ Erro ao obter saldo:', error.message);
    throw error;
  }
}

/**
 * Busca histórico de mensagens
 */
export async function buscarHistoricoMensagens(limite: number = 20): Promise<any[]> {
  try {
    if (!twilioClient) {
      throw new Error('Twilio não configurado');
    }

    const messages = await twilioClient.messages.list({ limit: limite });
    
    return messages.map(msg => ({
      sid: msg.sid,
      para: msg.to,
      de: msg.from,
      status: msg.status,
      corpo: msg.body,
      data: msg.dateCreated,
      preco: msg.price,
      erro: msg.errorMessage
    }));
  } catch (error: any) {
    console.error('❌ Erro ao buscar histórico:', error.message);
    throw error;
  }
}

/**
 * Substitui variáveis no template
 */
export async function substituirVariaveis(
  template: string,
  variaveis: Record<string, string | number>
): Promise<string> {
  let resultado = template;
  
  Object.entries(variaveis).forEach(([chave, valor]) => {
    const regex = new RegExp(`{{${chave}}}`, 'g');
    resultado = resultado.replace(regex, String(valor));
  });

  return resultado;
}

/**
 * Valida número de telefone
 */
export function validarNumero(numero: string): boolean {
  const numeroLimpo = numero.replace(/\D/g, '');
  
  // Validar formato brasileiro: 11 dígitos (DDD + número)
  if (numeroLimpo.length < 10 || numeroLimpo.length > 11) {
    return false;
  }
  
  return true;
}

/**
 * Formata número para padrão internacional
 */
export function formatarNumero(numero: string): string {
  const numeroLimpo = numero.replace(/\D/g, '');
  
  // Adicionar código do país se não tiver
  const numeroFormatado = numeroLimpo.startsWith('55') 
    ? numeroLimpo 
    : `55${numeroLimpo}`;
  
  return `whatsapp:+${numeroFormatado}`;
}

// Log de inicialização
if (twilioClient) {
  console.log('✅ Twilio WhatsApp Service inicializado');
  console.log(`📱 Número: ${process.env.TWILIO_WHATSAPP_NUMBER || 'Não configurado'}`);
  
  // Verificar conexão na inicialização
  verificarConexao().catch(err => {
    console.error('❌ Erro ao verificar conexão inicial:', err);
  });
} else {
  console.log('⚠️  Twilio WhatsApp Service não configurado');
  console.log('ℹ️  Adicione TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_NUMBER');
}
