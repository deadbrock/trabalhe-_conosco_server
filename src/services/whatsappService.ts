import * as wppconnect from '@wppconnect-team/wppconnect';
// @ts-ignore - qrcode-terminal não tem tipos
import qrcode from 'qrcode-terminal';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let client: any = null;
let isInitializing = false;
let qrCodeBase64: string | null = null;

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
 * Inicia a conexão do WhatsApp
 */
export async function iniciarWhatsApp(): Promise<any> {
  if (client) {
    console.log('✅ WhatsApp já está conectado');
    return client;
  }

  if (isInitializing) {
    console.log('⏳ WhatsApp já está inicializando...');
    // Aguardar inicialização
    await new Promise(resolve => setTimeout(resolve, 2000));
    return client;
  }

  try {
    isInitializing = true;
    console.log('🔄 Iniciando WhatsApp...');

    client = await wppconnect.create({
      session: 'trabalhe-conosco',
      catchQR: (base64Qr: string, asciiQR: string, attempts: number) => {
        console.log('📱 QR Code gerado! Escaneie com o WhatsApp');
        console.log(`Tentativa: ${attempts}/5`);
        
        // Exibir QR Code no terminal
        qrcode.generate(base64Qr, { small: true });
        
        // Salvar QR Code para API
        qrCodeBase64 = base64Qr;
        
        // Salvar no banco para exibir no frontend
        salvarQRCode(base64Qr).catch(err => {
          console.error('Erro ao salvar QR Code:', err);
        });
      },
      logQR: false,
      statusFind: (statusSession: string, session: string) => {
        console.log(`📊 Status: ${statusSession}`);
        
        if (statusSession === 'qrReadSuccess') {
          console.log('✅ QR Code escaneado com sucesso!');
        } else if (statusSession === 'isLogged') {
          console.log('✅ WhatsApp conectado!');
        } else if (statusSession === 'notLogged') {
          console.log('⚠️ WhatsApp não está logado');
        }
      },
      folderNameToken: './tokens',
      headless: true,
      devtools: false,
      useChrome: false,
      debug: false,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    } as any);

    console.log('✅ WhatsApp conectado com sucesso!');
    isInitializing = false;
    return client;

  } catch (error: any) {
    console.error('❌ Erro ao iniciar WhatsApp:', error);
    isInitializing = false;
    client = null;
    throw error;
  }
}

/**
 * Envia mensagem via WhatsApp
 */
export async function enviarWhatsApp({
  numero,
  mensagem
}: EnviarWhatsAppParams): Promise<ResultadoEnvio> {
  try {
    // Verificar se está conectado
    if (!client) {
      console.log('⚠️ WhatsApp não conectado. Tentando conectar...');
      await iniciarWhatsApp();
    }

    // Limpar e formatar número
    const numeroLimpo = numero.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    const numeroFormatado = numeroLimpo.startsWith('55') 
      ? numeroLimpo 
      : `55${numeroLimpo}`;

    // Adicionar @c.us se não tiver
    const numeroCompleto = numeroFormatado.includes('@') 
      ? numeroFormatado 
      : `${numeroFormatado}@c.us`;

    console.log(`📤 Enviando WhatsApp para: ${numeroCompleto}`);

    // Enviar mensagem
    const result = await client.sendText(numeroCompleto, mensagem);

    console.log(`✅ WhatsApp enviado com sucesso! ID: ${result.id}`);

    return {
      sucesso: true,
      messageId: result.id
    };

  } catch (error: any) {
    console.error('❌ Erro ao enviar WhatsApp:', error.message);

    // Se erro de conexão, tentar reconectar
    if (error.message && error.message.includes('not connected')) {
      console.log('🔄 Tentando reconectar...');
      client = null;
      return {
        sucesso: false,
        erro: 'WhatsApp desconectado. Escaneie o QR Code novamente.'
      };
    }

    return {
      sucesso: false,
      erro: error.message || 'Erro desconhecido ao enviar WhatsApp'
    };
  }
}

/**
 * Verifica se o WhatsApp está conectado
 */
export async function verificarConexao(): Promise<boolean> {
  try {
    if (!client) {
      return false;
    }

    const status = await client.getConnectionState();
    return status === 'CONNECTED';
  } catch (error) {
    console.error('❌ Erro ao verificar conexão:', error);
    return false;
  }
}

/**
 * Desconecta o WhatsApp
 */
export async function desconectarWhatsApp(): Promise<void> {
  try {
    if (client) {
      await client.close();
      client = null;
      console.log('✅ WhatsApp desconectado');
    }
  } catch (error) {
    console.error('❌ Erro ao desconectar WhatsApp:', error);
  }
}

/**
 * Retorna o QR Code atual (se houver)
 */
export function obterQRCode(): string | null {
  return qrCodeBase64;
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
 * Salva QR Code no banco para exibir no frontend
 */
async function salvarQRCode(base64: string): Promise<void> {
  try {
    // Criar tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_qrcode (
        id SERIAL PRIMARY KEY,
        qrcode TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    // Deletar QR Codes antigos
    await pool.query('DELETE FROM whatsapp_qrcode');

    // Inserir novo QR Code
    await pool.query(
      'INSERT INTO whatsapp_qrcode (qrcode) VALUES ($1)',
      [base64]
    );

    console.log('✅ QR Code salvo no banco');
  } catch (error) {
    console.error('❌ Erro ao salvar QR Code:', error);
  }
}

/**
 * Busca o QR Code mais recente do banco
 */
export async function buscarQRCodeDoBanco(): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT qrcode FROM whatsapp_qrcode ORDER BY criado_em DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      return result.rows[0].qrcode;
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar QR Code:', error);
    return null;
  }
}

// Inicializar WhatsApp automaticamente ao startar o servidor (DESABILITADO)
// Para habilitar, adicione WHATSAPP_AUTO_START=true nas variáveis de ambiente
if (process.env.WHATSAPP_AUTO_START === 'true') {
  console.log('🚀 Iniciando WhatsApp automaticamente...');
  iniciarWhatsApp().catch(err => {
    console.error('❌ Erro ao iniciar WhatsApp automaticamente:', err);
  });
} else {
  console.log('ℹ️  WhatsApp auto-start desabilitado. Use /whatsapp/iniciar para conectar manualmente.');
}
