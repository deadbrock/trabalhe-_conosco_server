import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedTemplates() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Iniciando seed de templates padrão...\n');

    await client.query('BEGIN');

    // ==========================================
    // TEMPLATES DE EMAIL
    // ==========================================
    console.log('📧 Criando templates de Email...');

    // 1. Inscrição Confirmada (Email)
    await client.query(`
      INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      'email',
      '✅ Inscrição Confirmada',
      'Inscrição recebida - {{vaga}} | {{empresa}}',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Inscrição Confirmada!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      
      <p>Recebemos sua candidatura para a vaga de <strong>{{vaga}}</strong>!</p>
      
      <h3>📋 Próximos Passos:</h3>
      <ul>
        <li>✅ Seu currículo foi recebido com sucesso</li>
        <li>⏰ Nossa equipe analisará seu perfil em até 5 dias úteis</li>
        <li>📞 Você receberá retorno por email e/ou WhatsApp</li>
      </ul>
      
      <p>Enquanto isso, fique atento aos seus contatos:</p>
      <p>📧 Email: {{email}}<br>
      📱 WhatsApp: {{telefone}}</p>
      
      <p><strong>Dica:</strong> Mantenha seu email e WhatsApp sempre ativos! 😊</p>
      
      <div class="footer">
        <p>Dúvidas? Responda este email ou entre em contato:<br>
        {{rh_email}} | {{rh_telefone}}</p>
        <p>© {{empresa}} - Sistema de Recrutamento</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
      JSON.stringify(['nome', 'vaga', 'email', 'telefone', 'empresa', 'rh_email', 'rh_telefone']),
      true
    ]);

    // 2. Em Análise (Email)
    await client.query(`
      INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      'email',
      '📋 Em Análise',
      'Seu currículo está em análise - {{vaga}}',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Currículo em Análise</h1>
    </div>
    <div class="content">
      <p>Oi <strong>{{nome}}</strong>! 😊</p>
      
      <p>Seu currículo para a vaga de <strong>{{vaga}}</strong> está sendo avaliado pela nossa equipe!</p>
      
      <p>📌 <strong>Status atual:</strong> Em análise detalhada</p>
      
      <p>⏳ Nossa equipe de RH está revisando cuidadosamente cada candidatura para encontrar o melhor match com nossa vaga.</p>
      
      <p><strong>Em breve você terá novidades!</strong> 🎯</p>
      
      <p>Obrigado pela paciência e interesse em fazer parte do time {{empresa}}!</p>
      
      <div class="footer">
        <p>{{rh_nome}}<br>
        {{empresa}}</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
      JSON.stringify(['nome', 'vaga', 'empresa', 'rh_nome']),
      true
    ]);

    // 3. Convite para Entrevista (Email)
    await client.query(`
      INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      'email',
      '🎉 Convite para Entrevista',
      '🎉 Você foi selecionado(a) para entrevista - {{vaga}}',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; border-left: 4px solid #4facfe; padding: 15px; margin: 20px 0; }
    .button { background: #4facfe; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 PARABÉNS!</h1>
      <h2>Você foi selecionado(a) para entrevista!</h2>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      
      <p>Temos o prazer de informar que você foi <strong>selecionado(a)</strong> para a próxima etapa do processo seletivo para a vaga de <strong>{{vaga}}</strong>!</p>
      
      <div class="info-box">
        <h3>📅 Detalhes da Entrevista:</h3>
        <p><strong>Data:</strong> {{data}}<br>
        <strong>Horário:</strong> {{hora}}<br>
        <strong>Local:</strong> {{local}}</p>
      </div>
      
      <p><strong>🔗 Link da videochamada:</strong><br>
      <a href="{{link}}" class="button">Entrar na Reunião</a></p>
      
      <h3>📝 Prepare-se:</h3>
      <ul>
        <li>Revise seu currículo</li>
        <li>Pesquise sobre a {{empresa}}</li>
        <li>Prepare perguntas para fazer</li>
        <li>Teste sua conexão e áudio/vídeo</li>
        <li>Chegue 5 minutos antes</li>
      </ul>
      
      <p><strong>Por favor, confirme sua presença respondendo este email!</strong> ✅</p>
      
      <p>Boa sorte! Estamos ansiosos para conhecê-lo(a)! 🍀</p>
      
      <div class="footer">
        <p>{{rh_nome}}<br>
        {{rh_email}} | {{rh_telefone}}<br>
        {{empresa}}</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
      JSON.stringify(['nome', 'vaga', 'data', 'hora', 'local', 'link', 'empresa', 'rh_nome', 'rh_email', 'rh_telefone']),
      true
    ]);

    // 4. Aprovado (Email)
    await client.query(`
      INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      'email',
      '🎊 Candidato Aprovado',
      '🎊 PARABÉNS! Você foi aprovado(a) - {{vaga}}',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .celebration { font-size: 48px; text-align: center; margin: 20px 0; }
    .next-steps { background: white; border-left: 4px solid #38ef7d; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="celebration">🎊🎉🎈</div>
      <h1>PARABÉNS {{nome}}!</h1>
      <h2>VOCÊ FOI APROVADO(A)!</h2>
    </div>
    <div class="content">
      <p>É com imenso prazer que informamos que você foi <strong>APROVADO(A)</strong> para a vaga de <strong>{{vaga}}</strong>!</p>
      
      <p>Sua experiência, habilidades e desempenho durante o processo seletivo nos impressionaram muito! 🌟</p>
      
      <div class="next-steps">
        <h3>🎯 Próximos Passos:</h3>
        <ol>
          <li><strong>Documentação:</strong> Em breve enviaremos a lista de documentos necessários</li>
          <li><strong>Contrato:</strong> Nossa equipe entrará em contato para formalização</li>
          <li><strong>Integração:</strong> Você receberá o cronograma de onboarding</li>
          <li><strong>Início:</strong> Data prevista será confirmada em breve</li>
        </ol>
      </div>
      
      <p><strong>📞 Fique atento aos próximos contatos!</strong></p>
      
      <p>Estamos muito felizes em tê-lo(a) conosco! Bem-vindo(a) à equipe {{empresa}}! 🚀</p>
      
      <div class="footer">
        <p>{{rh_nome}}<br>
        {{rh_email}} | {{rh_telefone}}<br>
        {{empresa}}</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
      JSON.stringify(['nome', 'vaga', 'empresa', 'rh_nome', 'rh_email', 'rh_telefone']),
      true
    ]);

    // 5. Reprovado (Email - Gentil)
    await client.query(`
      INSERT INTO templates (tipo, nome, assunto, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      'email',
      '💼 Feedback do Processo Seletivo',
      'Processo Seletivo - {{vaga}} | {{empresa}}',
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .highlight-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Obrigado por Participar!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      
      <p>Primeiramente, agradecemos muito pelo seu interesse e participação no processo seletivo para a vaga de <strong>{{vaga}}</strong>.</p>
      
      <p>Após cuidadosa análise, optamos por seguir com candidatos cujos perfis estão mais alinhados com as necessidades específicas desta vaga neste momento.</p>
      
      <p>Mas <strong>não desanime</strong>! Esta decisão não diminui seus méritos profissionais. 💪</p>
      
      <div class="highlight-box">
        <h3>💼 Banco de Talentos</h3>
        <p>Seu currículo ficará em nosso <strong>banco de talentos</strong> e você será considerado(a) para futuras oportunidades que se encaixem melhor com seu perfil!</p>
      </div>
      
      <p><strong>✨ Continue se desenvolvendo!</strong> Cada processo é uma oportunidade de aprendizado.</p>
      
      <p>As portas da {{empresa}} estão sempre abertas para profissionais talentosos como você! 🚀</p>
      
      <p>Desejamos muito sucesso na sua jornada profissional!</p>
      
      <div class="footer">
        <p>Com carinho,<br>
        {{rh_nome}}<br>
        {{empresa}}</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
      JSON.stringify(['nome', 'vaga', 'empresa', 'rh_nome']),
      true
    ]);

    console.log('✅ 5 templates de Email criados\n');

    // ==========================================
    // TEMPLATES DE WHATSAPP
    // ==========================================
    console.log('💬 Criando templates de WhatsApp...');

    // 1. Inscrição Confirmada (WhatsApp)
    await client.query(`
      INSERT INTO templates (tipo, nome, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'whatsapp',
      '✅ Inscrição Confirmada (WhatsApp)',
      `Olá *{{nome}}*! 👋

Recebemos sua candidatura para *{{vaga}}*!

✅ Currículo recebido
⏰ Retornaremos em até 5 dias úteis
📧 Acompanhe também seu email: {{email}}

Dúvidas? Responda esta mensagem!

Boa sorte! 🍀

_{{empresa}}_`,
      JSON.stringify(['nome', 'vaga', 'email', 'empresa']),
      true
    ]);

    // 2. Em Análise (WhatsApp)
    await client.query(`
      INSERT INTO templates (tipo, nome, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'whatsapp',
      '📋 Em Análise (WhatsApp)',
      `Oi *{{nome}}*! 😊

Seu currículo para *{{vaga}}* está em análise!

📋 Nossa equipe está avaliando seu perfil
⏳ Em breve você terá novidades

Obrigado pela paciência!

_{{empresa}}_`,
      JSON.stringify(['nome', 'vaga', 'empresa']),
      true
    ]);

    // 3. Convite para Entrevista (WhatsApp)
    await client.query(`
      INSERT INTO templates (tipo, nome, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'whatsapp',
      '🎉 Convite para Entrevista (WhatsApp)',
      `🎉 *PARABÉNS {{nome}}!*

Você foi *selecionado(a)* para entrevista!

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

🔗 *Link:* {{link}}

Por favor, *confirme sua presença* respondendo esta mensagem! ✅

Boa sorte! 🍀

_{{rh_nome}} - {{empresa}}_`,
      JSON.stringify(['nome', 'data', 'hora', 'local', 'link', 'rh_nome', 'empresa']),
      true
    ]);

    // 4. Aprovado (WhatsApp)
    await client.query(`
      INSERT INTO templates (tipo, nome, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'whatsapp',
      '🎊 Candidato Aprovado (WhatsApp)',
      `🎊 *PARABÉNS {{nome}}!* 🎊

Você foi *APROVADO(A)* para *{{vaga}}*!

🎯 *Próximos passos:*
1. Contato do RH
2. Documentação
3. Início em breve

📞 Fique atento aos nossos contatos!

*Bem-vindo(a) à equipe {{empresa}}!* 🚀

_{{rh_nome}}_`,
      JSON.stringify(['nome', 'vaga', 'empresa', 'rh_nome']),
      true
    ]);

    // 5. Reprovado (WhatsApp - Gentil)
    await client.query(`
      INSERT INTO templates (tipo, nome, conteudo, variaveis, ativo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      'whatsapp',
      '💼 Feedback Processo Seletivo (WhatsApp)',
      `Olá *{{nome}}*,

Agradecemos muito seu interesse em *{{vaga}}*.

Infelizmente, neste momento, optamos por outro perfil. 😔

Mas *não desanime!* Seu currículo ficará em nosso *banco de talentos* para futuras oportunidades! 💼

✨ Continue se desenvolvendo!

As portas da {{empresa}} estão sempre abertas! 🚪

Desejamos muito sucesso! 🌟

_{{rh_nome}}_`,
      JSON.stringify(['nome', 'vaga', 'empresa', 'rh_nome']),
      true
    ]);

    console.log('✅ 5 templates de WhatsApp criados\n');

    // ==========================================
    // ATUALIZAR CONFIGURAÇÃO DE GATILHOS
    // ==========================================
    console.log('⚙️ Vinculando templates aos gatilhos...');

    // Buscar IDs dos templates criados
    const emailTemplates = await client.query(`
      SELECT id, nome FROM templates WHERE tipo = 'email' ORDER BY id
    `);

    const whatsappTemplates = await client.query(`
      SELECT id, nome FROM templates WHERE tipo = 'whatsapp' ORDER BY id
    `);

    // Mapear templates
    const emailMap: Record<string, number> = {};
    emailTemplates.rows.forEach((t: any) => {
      if (t.nome.includes('Inscrição')) emailMap['inscricao'] = t.id;
      if (t.nome.includes('Análise')) emailMap['analise'] = t.id;
      if (t.nome.includes('Entrevista')) emailMap['entrevista'] = t.id;
      if (t.nome.includes('Aprovado')) emailMap['aprovado'] = t.id;
      if (t.nome.includes('Feedback')) emailMap['reprovado'] = t.id;
    });

    const whatsappMap: Record<string, number> = {};
    whatsappTemplates.rows.forEach((t: any) => {
      if (t.nome.includes('Inscrição')) whatsappMap['inscricao'] = t.id;
      if (t.nome.includes('Análise')) whatsappMap['analise'] = t.id;
      if (t.nome.includes('Entrevista')) whatsappMap['entrevista'] = t.id;
      if (t.nome.includes('Aprovado')) whatsappMap['aprovado'] = t.id;
      if (t.nome.includes('Feedback')) whatsappMap['reprovado'] = t.id;
    });

    // Atualizar gatilhos
    if (emailMap['inscricao'] && whatsappMap['inscricao']) {
      await client.query(`
        UPDATE configuracao_gatilhos 
        SET template_email_id = $1, template_whatsapp_id = $2
        WHERE evento = 'inscricao_recebida'
      `, [emailMap['inscricao'], whatsappMap['inscricao']]);
    }

    if (emailMap['analise']) {
      await client.query(`
        UPDATE configuracao_gatilhos 
        SET template_email_id = $1
        WHERE evento = 'status_em_analise'
      `, [emailMap['analise']]);
    }

    if (emailMap['entrevista'] && whatsappMap['entrevista']) {
      await client.query(`
        UPDATE configuracao_gatilhos 
        SET template_email_id = $1, template_whatsapp_id = $2
        WHERE evento = 'convite_entrevista'
      `, [emailMap['entrevista'], whatsappMap['entrevista']]);
    }

    if (emailMap['aprovado'] && whatsappMap['aprovado']) {
      await client.query(`
        UPDATE configuracao_gatilhos 
        SET template_email_id = $1, template_whatsapp_id = $2
        WHERE evento = 'status_aprovado'
      `, [emailMap['aprovado'], whatsappMap['aprovado']]);
    }

    if (emailMap['reprovado'] && whatsappMap['reprovado']) {
      await client.query(`
        UPDATE configuracao_gatilhos 
        SET template_email_id = $1, template_whatsapp_id = $2
        WHERE evento = 'status_reprovado'
      `, [emailMap['reprovado'], whatsappMap['reprovado']]);
    }

    console.log('✅ Gatilhos vinculados aos templates\n');

    await client.query('COMMIT');

    console.log('🎉 Seed de templates concluído com sucesso!\n');
    console.log('📊 Resumo:');
    console.log('   - 5 templates de Email');
    console.log('   - 5 templates de WhatsApp');
    console.log('   - Gatilhos configurados\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 Erro no seed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTemplates()
  .then(() => {
    console.log('✅ Seed finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha no seed:', error);
    process.exit(1);
  });

