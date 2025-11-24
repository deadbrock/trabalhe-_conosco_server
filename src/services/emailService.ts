import sgMail from '@sendgrid/mail';

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configurado');
} else {
  console.warn('⚠️ SENDGRID_API_KEY não configurada');
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

export async function enviarEmail({
  destinatario,
  assunto,
  conteudo,
  remetenteNome = 'RH - FG Services',
  remetenteEmail = 'rh@trabalheconoscofg.com.br'
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

    // Enviar via SendGrid
    const msg = {
      to: destinatario,
      from: {
        email: remetenteEmail,
        name: remetenteNome
      },
      subject: assunto,
      html: conteudo
    };

    const response = await sgMail.send(msg);

    console.log(`✅ Email enviado com sucesso via SendGrid para ${destinatario} - ID: ${response[0].headers['x-message-id']}`);
    
    return {
      sucesso: true,
      messageId: response[0].headers['x-message-id'] as string
    };
  } catch (error: any) {
    console.error('❌ Erro ao enviar email via SendGrid:', error);
    
    // SendGrid retorna erros detalhados
    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || 'Erro desconhecido';
    
    return {
      sucesso: false,
      erro: errorMessage
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

