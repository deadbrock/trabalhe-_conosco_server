/**
 * 📧 Serviço de Email usando SendGrid (Twilio)
 * 
 * Alternativa ao Resend para envio de emails
 */

const sgMail = require('@sendgrid/mail');

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configurado');
} else {
  console.warn('⚠️  SENDGRID_API_KEY não configurado');
}

interface EnviarEmailParams {
  destinatario: string;
  assunto: string;
  conteudo: string;
  remetenteNome?: string;
  remetenteEmail?: string;
}

interface ResultadoEnvio {
  sucesso: boolean;
  messageId?: string;
  erro?: string;
}

export async function enviarEmailSendGrid({
  destinatario,
  assunto,
  conteudo,
  remetenteNome = 'RH - FG Services',
  remetenteEmail = 'trabalheconoscofg@fgservices.com.br'
}: EnviarEmailParams): Promise<ResultadoEnvio> {
  try {
    // Verificar se SendGrid está configurado
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SENDGRID_API_KEY não configurada. Email não será enviado.');
      return {
        sucesso: false,
        erro: 'Serviço de email não configurado'
      };
    }

    const msg = {
      to: destinatario,
      from: {
        email: remetenteEmail,
        name: remetenteNome
      },
      subject: assunto,
      html: conteudo
    };

    const [response] = await sgMail.send(msg);

    console.log('✅ Email enviado via SendGrid:', {
      destinatario,
      assunto,
      messageId: response.headers['x-message-id']
    });

    return {
      sucesso: true,
      messageId: response.headers['x-message-id'] || 'unknown'
    };
  } catch (error: any) {
    console.error('❌ Erro ao enviar email via SendGrid:', {
      message: error.message,
      code: error.code,
      response: error.response?.body
    });

    return {
      sucesso: false,
      erro: error.response?.body?.errors?.[0]?.message || error.message || 'Erro desconhecido'
    };
  }
}

export async function substituirVariaveis(
  texto: string,
  variaveis: Record<string, string | number>
): Promise<string> {
  let resultado = texto;

  for (const [chave, valor] of Object.entries(variaveis)) {
    const regex = new RegExp(`{{\\s*${chave}\\s*}}`, 'g');
    resultado = resultado.replace(regex, String(valor));
  }

  return resultado;
}

