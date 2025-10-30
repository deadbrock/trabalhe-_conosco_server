import { Pool } from 'pg';
import { enviarEmail, substituirVariaveis as substituirVariaveisEmail } from './emailService';
import { enviarWhatsApp, substituirVariaveis as substituirVariaveisWhatsApp } from './whatsappService';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface DadosCandidato {
  id: number;
  nome: string;
  email: string;
  telefone: string;
}

interface DadosVaga {
  id: number;
  titulo: string;
}

interface DadosAgendamento {
  data: string;
  hora: string;
  local?: string;
  link?: string;
}

interface DadosVariaveis {
  nome: string;
  email: string;
  telefone: string;
  vaga: string;
  empresa?: string;
  data?: string;
  hora?: string;
  local?: string;
  link?: string;
  rh_nome?: string;
  rh_email?: string;
  rh_telefone?: string;
  [key: string]: string | undefined;
}

function devePularHorarioComercial(
  horarioComercial: boolean,
  diasUteis: boolean,
  horarioInicio: string,
  horarioFim: string
): boolean {
  if (!horarioComercial && !diasUteis) {
    return false;
  }

  const agora = new Date();
  const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado

  // Verificar dias úteis
  if (diasUteis && (diaSemana === 0 || diaSemana === 6)) {
    return true; // Pular fins de semana
  }

  // Verificar horário comercial
  if (horarioComercial) {
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [inicioH, inicioM] = horarioInicio.split(':').map(Number);
    const [fimH, fimM] = horarioFim.split(':').map(Number);
    
    const minutoInicio = inicioH * 60 + inicioM;
    const minutoFim = fimH * 60 + fimM;

    if (horaAtual < minutoInicio || horaAtual > minutoFim) {
      return true; // Pular fora do horário comercial
    }
  }

  return false;
}

async function montarVariaveis(
  candidatoId: number,
  vagaId?: number,
  dadosExtras?: Partial<DadosVariaveis>
): Promise<DadosVariaveis> {
  // Buscar dados do candidato
  const candidatoResult = await pool.query(
    'SELECT id, nome, email, telefone FROM candidatos WHERE id = $1',
    [candidatoId]
  );

  if (candidatoResult.rows.length === 0) {
    throw new Error('Candidato não encontrado');
  }

  const candidato = candidatoResult.rows[0] as DadosCandidato;

  const variaveis: DadosVariaveis = {
    nome: candidato.nome,
    email: candidato.email,
    telefone: candidato.telefone,
    vaga: '',
    empresa: 'FG Services',
    data: new Date().toLocaleDateString('pt-BR'),
    rh_nome: 'Equipe de RH',
    rh_email: 'rh@trabalheconoscofg.com.br',
    rh_telefone: '(11) 3456-7890',
    ...dadosExtras
  };

  // Buscar dados da vaga se fornecido
  if (vagaId) {
    const vagaResult = await pool.query(
      'SELECT id, titulo FROM vagas WHERE id = $1',
      [vagaId]
    );

    if (vagaResult.rows.length > 0) {
      variaveis.vaga = vagaResult.rows[0].titulo;
    }
  }

  return variaveis;
}

export async function dispararGatilho(
  evento: string,
  candidatoId: number,
  vagaId?: number,
  dadosExtras?: Partial<DadosVariaveis>
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    console.log(`🔔 Disparando gatilho: ${evento} para candidato ${candidatoId}`);

    // Buscar configuração do gatilho
    const gatilhoResult = await pool.query(
      `SELECT 
        g.*,
        te.conteudo as email_conteudo,
        te.assunto as email_assunto,
        tw.conteudo as whatsapp_conteudo
      FROM configuracao_gatilhos g
      LEFT JOIN templates te ON g.template_email_id = te.id AND te.ativo = true
      LEFT JOIN templates tw ON g.template_whatsapp_id = tw.id AND tw.ativo = true
      WHERE g.evento = $1`,
      [evento]
    );

    if (gatilhoResult.rows.length === 0) {
      console.warn(`⚠️ Gatilho não encontrado: ${evento}`);
      return { sucesso: false, mensagem: 'Gatilho não configurado' };
    }

    const gatilho = gatilhoResult.rows[0];

    // Verificar se deve pular por horário
    if (devePularHorarioComercial(
      gatilho.horario_comercial,
      gatilho.dias_uteis,
      gatilho.horario_inicio,
      gatilho.horario_fim
    )) {
      console.log('⏰ Fora do horário configurado. Adicionando à fila...');
      
      // TODO: Adicionar à fila para envio posterior
      return { sucesso: true, mensagem: 'Adicionado à fila para envio posterior' };
    }

    // Montar variáveis
    const variaveis = await montarVariaveis(candidatoId, vagaId, dadosExtras);

    const resultados: string[] = [];

    // Enviar Email se ativo
    if (gatilho.email_ativo && gatilho.email_conteudo) {
      const assunto = await substituirVariaveisEmail(gatilho.email_assunto || '', variaveis);
      const conteudo = await substituirVariaveisEmail(gatilho.email_conteudo, variaveis);

      const resultado = await enviarEmail({
        destinatario: variaveis.email,
        assunto,
        conteudo
      });

      // Salvar no histórico
      await pool.query(
        `INSERT INTO historico_comunicacao 
          (candidato_id, vaga_id, template_id, tipo, destinatario, assunto, conteudo, status, erro, enviado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          candidatoId,
          vagaId || null,
          gatilho.template_email_id,
          'email',
          variaveis.email,
          assunto,
          conteudo,
          resultado.sucesso ? 'enviado' : 'falhou',
          resultado.erro || null,
          'automatico'
        ]
      );

      resultados.push(resultado.sucesso ? '✅ Email enviado' : `❌ Email falhou: ${resultado.erro}`);
    }

    // Enviar WhatsApp se ativo
    if (gatilho.whatsapp_ativo && gatilho.whatsapp_conteudo) {
      const conteudo = await substituirVariaveisWhatsApp(gatilho.whatsapp_conteudo, variaveis);

      const resultado = await enviarWhatsApp({
        numero: variaveis.telefone,
        mensagem: conteudo
      });

      // Salvar no histórico
      await pool.query(
        `INSERT INTO historico_comunicacao 
          (candidato_id, vaga_id, template_id, tipo, destinatario, conteudo, status, erro, enviado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          candidatoId,
          vagaId || null,
          gatilho.template_whatsapp_id,
          'whatsapp',
          variaveis.telefone,
          conteudo,
          resultado.sucesso ? 'enviado' : 'falhou',
          resultado.erro || null,
          'automatico'
        ]
      );

      resultados.push(resultado.sucesso ? '✅ WhatsApp enviado' : `❌ WhatsApp falhou: ${resultado.erro}`);
    }

    if (resultados.length === 0) {
      console.log('⚠️ Nenhum canal ativo para este gatilho');
      return { sucesso: false, mensagem: 'Nenhum canal ativo' };
    }

    console.log(`✅ Gatilho ${evento} processado: ${resultados.join(', ')}`);
    return { sucesso: true, mensagem: resultados.join(', ') };

  } catch (error: any) {
    console.error(`❌ Erro ao disparar gatilho ${evento}:`, error);
    return { sucesso: false, mensagem: error.message || 'Erro desconhecido' };
  }
}

// Funções específicas para cada evento
export async function notificarInscricao(candidatoId: number, vagaId: number) {
  return dispararGatilho('inscricao_recebida', candidatoId, vagaId);
}

export async function notificarEmAnalise(candidatoId: number, vagaId: number) {
  return dispararGatilho('status_em_analise', candidatoId, vagaId);
}

export async function notificarPreSelecionado(candidatoId: number, vagaId: number) {
  return dispararGatilho('status_pre_selecionado', candidatoId, vagaId);
}

export async function notificarConviteEntrevista(
  candidatoId: number,
  vagaId: number,
  agendamento: DadosAgendamento
) {
  return dispararGatilho('convite_entrevista', candidatoId, vagaId, {
    data: agendamento.data,
    hora: agendamento.hora,
    local: agendamento.local,
    link: agendamento.link
  });
}

export async function notificarAprovado(candidatoId: number, vagaId: number) {
  return dispararGatilho('status_aprovado', candidatoId, vagaId);
}

export async function notificarReprovado(candidatoId: number, vagaId: number) {
  return dispararGatilho('status_reprovado', candidatoId, vagaId);
}

