import { Resend } from 'resend';
import { enviarEmailSendGrid } from './sendgridService';

const resend = new Resend(process.env.RESEND_API_KEY);

// Determinar qual provedor usar
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'; // 'resend' ou 'sendgrid'

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

export async function enviarEmail({
  destinatario,
  assunto,
  conteudo,
  remetenteNome = 'RH - FG Services',
  remetenteEmail
}: EnviarEmailParams): Promise<ResultadoEnvio> {
  // Definir email padrão baseado no provedor
  const emailPadrao = EMAIL_PROVIDER === 'sendgrid' 
    ? 'trabalheconoscofg@fgservices.com.br'
    : 'rh@trabalheconoscofg.com.br';
  
  const emailRemetente = remetenteEmail || emailPadrao;

  // Usar SendGrid se configurado
  if (EMAIL_PROVIDER === 'sendgrid' || process.env.SENDGRID_API_KEY) {
    console.log('📧 Usando SendGrid para enviar email...');
    return enviarEmailSendGrid({
      destinatario,
      assunto,
      conteudo,
      remetenteNome,
      remetenteEmail: emailRemetente
    });
  }

  // Fallback para Resend
  try {
    // Verificar se Resend está configurado
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ Nenhum provedor de email configurado (RESEND_API_KEY ou SENDGRID_API_KEY)');
      return {
        sucesso: false,
        erro: 'Serviço de email não configurado'
      };
    }

    console.log('📧 Usando Resend para enviar email...');

    const { data, error } = await resend.emails.send({
      from: `${remetenteNome} <${emailRemetente}>`,
      to: [destinatario],
      subject: assunto,
      html: conteudo
    });

    if (error) {
      console.error('❌ Erro ao enviar email via Resend:', error);
      return {
        sucesso: false,
        erro: error.message || 'Erro desconhecido ao enviar email'
      };
    }

    console.log(`✅ Email enviado com sucesso via Resend para ${destinatario} - ID: ${data?.id}`);
    
    return {
      sucesso: true,
      messageId: data?.id
    };
  } catch (error: any) {
    console.error('❌ Exceção ao enviar email:', error);
    return {
      sucesso: false,
      erro: error.message || 'Erro desconhecido'
    };
  }
}

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

