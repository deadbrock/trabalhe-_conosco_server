import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    // Verificar se Resend está configurado
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurada. Email não será enviado.');
      return {
        sucesso: false,
        erro: 'Serviço de email não configurado'
      };
    }

    const { data, error } = await resend.emails.send({
      from: `${remetenteNome} <${remetenteEmail}>`,
      to: [destinatario],
      subject: assunto,
      html: conteudo
    });

    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      return {
        sucesso: false,
        erro: error.message || 'Erro desconhecido ao enviar email'
      };
    }

    console.log(`✅ Email enviado com sucesso para ${destinatario} - ID: ${data?.id}`);
    
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

