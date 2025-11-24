/**
 * Serviço para enviar notificações sobre documentos (email/WhatsApp)
 */

import { enviarEmail } from './emailService';
import { enviarWhatsApp } from './whatsappService';

interface DadosNotificacao {
  nome: string;
  email: string;
  telefone?: string;
  linkDocumentos: string;
  vagaTitulo?: string;
}

/**
 * Envia notificação por email com link de documentos
 */
export async function enviarEmailDocumentos(dados: DadosNotificacao): Promise<boolean> {
  try {
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #f5f6fa;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #a2122a 0%, #354a80 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            opacity: 0.95;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #a2122a;
            margin-top: 0;
            font-size: 22px;
          }
          .content p {
            color: #444;
            line-height: 1.8;
            font-size: 15px;
          }
          .alert-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .alert-box strong {
            color: #856404;
            display: block;
            margin-bottom: 8px;
          }
          .alert-box ul {
            margin: 0;
            padding-left: 20px;
            color: #856404;
          }
          .alert-box li {
            margin: 5px 0;
          }
          .btn {
            display: inline-block;
            padding: 16px 40px;
            background: linear-gradient(135deg, #a2122a 0%, #d32f2f 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(162, 18, 42, 0.3);
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
          }
          .documents-list {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
          }
          .documents-list h3 {
            margin-top: 0;
            color: #354a80;
            font-size: 18px;
          }
          .documents-list ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .documents-list li {
            margin: 8px 0;
            color: #555;
          }
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #777;
            font-size: 13px;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Parabéns, ${dados.nome}!</h1>
            <p>Você foi aprovado${dados.vagaTitulo ? ` para a vaga de ${dados.vagaTitulo}` : ''}!</p>
          </div>
          
          <div class="content">
            <h2>📄 Próxima Etapa: Envio de Documentos</h2>
            
            <p>
              Para prosseguir com o processo de admissão, precisamos que você envie alguns 
              documentos essenciais através do nosso sistema seguro.
            </p>
            
            <div class="alert-box">
              <strong>⚠️ Requisitos Importantes:</strong>
              <ul>
                <li>Todas as fotos devem estar <strong>nítidas e legíveis</strong></li>
                <li>Documentos não podem estar <strong>rasurados ou embaçados</strong></li>
                <li>O comprovante de residência deve ser de <strong>até 3 meses atrás</strong></li>
                <li>Formatos aceitos: JPG, PNG, PDF</li>
              </ul>
            </div>
            
            <div class="documents-list">
              <h3>📋 Documentos Necessários:</h3>
              <ul>
                <li>✓ Carteira de Trabalho Digital</li>
                <li>✓ Identidade (frente e verso)</li>
                <li>✓ Comprovante de Residência (até 3 meses)</li>
                <li>✓ Certidão de Nascimento ou Casamento</li>
                <li>✓ Certificado de Reservista (se masculino)</li>
                <li>✓ Título de Eleitor</li>
                <li>✓ Antecedentes Criminais / Nada Consta</li>
              </ul>
              
              <p style="margin-top: 15px; font-size: 13px; color: #666;">
                <em>Se você tiver filhos até 13 anos, será necessário enviar também 
                Certidão de Nascimento e CPF deles.</em>
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="${dados.linkDocumentos}" class="btn">
                📤 Enviar Documentos Agora
              </a>
            </div>
            
            <p style="margin-top: 30px; color: #777; font-size: 14px;">
              <strong>Link de acesso:</strong><br>
              <a href="${dados.linkDocumentos}" style="color: #a2122a; word-break: break-all;">${dados.linkDocumentos}</a>
            </p>
            
            <p style="margin-top: 20px; font-size: 13px; color: #999;">
              Este link é exclusivo para você e válido por 30 dias. 
              Caso tenha dúvidas, entre em contato com o RH.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>FG Services</strong></p>
            <p>Trabalhe Conosco - Recursos Humanos</p>
            <p>© 2025 Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const resultado = await enviarEmail({
      destinatario: dados.email,
      assunto: '🎉 Parabéns! Envie seus documentos para admissão - FG Services',
      conteudo: htmlEmail,
    });
    
    return resultado.sucesso;
  } catch (error) {
    console.error('Erro ao enviar email de documentos:', error);
    return false;
  }
}

/**
 * Envia notificação por WhatsApp com link de documentos
 */
export async function enviarWhatsAppDocumentos(dados: DadosNotificacao): Promise<boolean> {
  try {
    if (!dados.telefone) {
      console.log('⚠️ Telefone não fornecido. WhatsApp não será enviado.');
      return false;
    }
    
    const mensagem = `
🎉 *Parabéns, ${dados.nome}!*

Você foi aprovado${dados.vagaTitulo ? ` para a vaga de *${dados.vagaTitulo}*` : ''}!

📄 *Próxima Etapa: Envio de Documentos*

Para prosseguir com a admissão, acesse o link abaixo e envie seus documentos:

🔗 ${dados.linkDocumentos}

⚠️ *Atenção:*
• Fotos devem estar nítidas e legíveis
• Comprovante de residência de até 3 meses
• Documentos não podem estar rasurados

📋 *Documentos necessários:*
✓ Carteira de Trabalho Digital
✓ Identidade (frente e verso)
✓ Comprovante de Residência
✓ Certidão de Nascimento/Casamento
✓ Reservista (se masculino)
✓ Título de Eleitor
✓ Antecedentes Criminais

Dúvidas? Entre em contato com o RH.

_FG Services - Recursos Humanos_
    `.trim();
    
    const resultado = await enviarWhatsApp(dados.telefone, mensagem);
    
    return resultado.sucesso;
  } catch (error) {
    console.error('Erro ao enviar WhatsApp de documentos:', error);
    return false;
  }
}

/**
 * Envia notificação completa (email + WhatsApp)
 */
export async function enviarNotificacaoDocumentos(dados: DadosNotificacao): Promise<{
  emailEnviado: boolean;
  whatsappEnviado: boolean;
}> {
  console.log(`📤 Enviando notificação de documentos para ${dados.nome}...`);
  
  const [emailEnviado, whatsappEnviado] = await Promise.all([
    enviarEmailDocumentos(dados),
    enviarWhatsAppDocumentos(dados),
  ]);
  
  console.log(`📊 Resultado: Email: ${emailEnviado ? '✅' : '❌'} | WhatsApp: ${whatsappEnviado ? '✅' : '❌'}`);
  
  return {
    emailEnviado,
    whatsappEnviado,
  };
}

