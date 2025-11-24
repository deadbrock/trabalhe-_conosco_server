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
    
    // Log detalhado do erro SendGrid
    if (error.response?.body?.errors) {
      console.error('📋 Detalhes do erro SendGrid:', JSON.stringify(error.response.body.errors, null, 2));
      
      const errorDetails = error.response.body.errors[0];
      console.error(`❌ Erro: ${errorDetails.message}`);
      console.error(`❌ Campo: ${errorDetails.field}`);
      console.error(`❌ Help: ${errorDetails.help}`);
    }
    
    // SendGrid retorna erros detalhados
    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || 'Erro desconhecido';
    
    // Sugestões baseadas no erro
    if (error.code === 403) {
      console.error('');
      console.error('🔧 POSSÍVEIS CAUSAS DO ERRO 403:');
      console.error('1. API Key inválida ou expirada');
      console.error('2. Email remetente não verificado no SendGrid');
      console.error('3. Conta SendGrid suspensa ou com pagamento pendente');
      console.error('');
      console.error('🔍 VERIFICAR:');
      console.error(`   - API Key: ${process.env.SENDGRID_API_KEY?.substring(0, 10)}...`);
      console.error(`   - Email remetente: ${remetenteEmail}`);
      console.error('   - Verificar em: https://app.sendgrid.com/settings/sender_auth/senders');
      console.error('');
    }
    
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

