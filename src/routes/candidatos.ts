import { Router } from "express";
import multer from "multer";
import * as cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { pool } from "../db";
import { notificarInscricao, notificarEmAnalise, notificarPreSelecionado, notificarAprovado, notificarReprovado } from "../services/gatilhosService";
import { enviarParaFGS } from "../services/fgsService";

// Configurar Cloudinary
const cld = cloudinary.v2;
cld.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🔧 Cloudinary Config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✅ Configurado" : "❌ Faltando",
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ Configurado" : "❌ Faltando",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Configurado" : "❌ Faltando"
});

// Configurar storage do Multer com Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cld,
  params: async (req, file) => {
    // Remove extensão do nome original e adiciona timestamp
    const originalName = file.originalname.replace(/\.[^/.]+$/, "");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    return {
      folder: "curriculos",
      public_id: `${sanitizedName}_${Date.now()}.pdf`,
      resource_type: "raw" as const,
      access_mode: "public" as const, // Permite acesso público ao arquivo
      use_filename: false,
      unique_filename: false,
    };
  },
});

const upload = multer({ storage: storage });
export const candidatosRouter = Router();

// Listar todos candidatos (com filtros opcionais)
candidatosRouter.get("/", async (req, res) => {
  const { status } = req.query as { status?: string };
  let query = "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id";
  const params: any[] = [];
  
  if (status && status !== "all") {
    params.push(status);
    query += ` WHERE c.status = $${params.length}`;
  }
  
  query += " ORDER BY c.data_cadastro DESC";
  
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

candidatosRouter.post("/", upload.single("curriculo"), async (req, res) => {
  try {
    const { nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, vaga_id } = req.body;
    
    // Verificar se o CPF já se candidatou para esta vaga
    const { rows: existing } = await pool.query(
      `SELECT id FROM candidatos WHERE cpf = $1 AND vaga_id = $2`,
      [cpf, vaga_id]
    );
    
    if (existing.length > 0) {
      console.log("⚠️ Candidatura duplicada bloqueada:", { cpf, vaga_id });
      return res.status(400).json({ 
        error: "Você já se candidatou para esta vaga!", 
        message: "Não é possível se candidatar novamente para a mesma vaga. Escolha outra vaga disponível."
      });
    }
    
    // Pega a URL completa do Cloudinary ou constrói manualmente
    const cloudinaryFile = req.file as any;
    let curriculoUrl = null;
    
    if (cloudinaryFile) {
      // Verificar se path é uma URL completa
      if (cloudinaryFile.path && cloudinaryFile.path.startsWith('http')) {
        curriculoUrl = cloudinaryFile.path;
      } else {
        // Construir URL do Cloudinary manualmente usando public_id e outros dados
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const publicId = cloudinaryFile.filename || cloudinaryFile.public_id;
        
        if (cloudName && publicId) {
          // URL do Cloudinary para arquivos raw
          curriculoUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`;
        }
      }
    }
    
    console.log("📤 Upload recebido:", {
      filename: req.file?.originalname,
      cloudinary_url: curriculoUrl,
      cloudinary_file: cloudinaryFile,
      size: req.file?.size
    });
    
    const { rows } = await pool.query(
      `INSERT INTO candidatos (nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculo, vaga_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculoUrl, vaga_id]
    );
    
    console.log("✅ Candidato salvo com sucesso:", rows[0].id, "| URL:", curriculoUrl);
    
    // 🔔 Disparar gatilho de inscrição recebida
    const candidato = rows[0];
    notificarInscricao(candidato.id, candidato.vaga_id).catch(err => {
      console.error('❌ Erro ao disparar gatilho de inscrição:', err);
      // Não bloquear a resposta se o gatilho falhar
    });
    
    res.status(201).json(candidato);
  } catch (error) {
    console.error("❌ Erro ao processar candidatura:", error);
    res.status(500).json({ error: "Erro ao processar candidatura", details: (error as Error).message });
  }
});

candidatosRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    
    const { rows } = await pool.query(
      `UPDATE candidatos SET status = COALESCE($1, status) WHERE id = $2 RETURNING *`,
      [status, id]
    );
    
    if (!rows[0]) return res.status(404).json({ error: "Candidato não encontrado" });
    
    const candidato = rows[0];
    
    // 🔔 Disparar gatilhos baseados no status
    if (status) {
      console.log(`🔔 Status alterado para: "${status}" (candidato ${candidato.id})`);
      
      // Normalizar status para lowercase para comparação
      const statusNormalizado = status.toLowerCase().trim();
      
      switch (statusNormalizado) {
        case 'em análise':
        case 'em_analise':
          notificarEmAnalise(candidato.id, candidato.vaga_id).catch(err => {
            console.error('❌ Erro ao disparar gatilho "Em análise":', err);
          });
          break;
          
        case 'pré-selecionado':
        case 'pre-selecionado':
        case 'pre_selecionado':
          notificarPreSelecionado(candidato.id, candidato.vaga_id).catch(err => {
            console.error('❌ Erro ao disparar gatilho "Pré-selecionado":', err);
          });
          break;
          
        case 'entrevista':
        case 'entrevista agendada':
          // Nota: Este gatilho requer dados de agendamento, usar a rota específica de agendamentos
          console.log('ℹ️ Status "Entrevista" - use o endpoint de agendamento para enviar convite');
          break;
          
        case 'aprovado':
          notificarAprovado(candidato.id, candidato.vaga_id).catch(err => {
            console.error('❌ Erro ao disparar gatilho "Aprovado":', err);
          });
          break;
          
        case 'reprovado':
          notificarReprovado(candidato.id, candidato.vaga_id).catch(err => {
            console.error('❌ Erro ao disparar gatilho "Reprovado":', err);
          });
          break;
          
        case 'banco de talentos':
        case 'banco_talentos':
          // Disparar gatilho de banco de talentos
          dispararGatilho('status_banco_talentos', candidato.id, candidato.vaga_id).catch(err => {
            console.error('❌ Erro ao disparar gatilho "Banco de Talentos":', err);
          });
          break;
          
        default:
          console.log(`ℹ️ Status "${status}" não possui gatilho automático configurado`);
      }
    }
    
    res.json(candidato);
  } catch (error) {
    console.error("❌ Erro ao atualizar candidato:", error);
    res.status(500).json({ error: "Erro ao atualizar candidato" });
  }
});

// Enviar candidato aprovado para o sistema FGS
// IMPORTANTE: Esta rota deve vir ANTES de GET /:vagaId para evitar conflito de rotas
candidatosRouter.post("/:id/enviar-fgs", async (req, res) => {
  try {
    const { id } = req.params;
    const candidatoId = parseInt(id);
    
    if (isNaN(candidatoId)) {
      return res.status(400).json({ error: "ID do candidato inválido" });
    }
    
    // Verificar se o candidato existe e está aprovado
    const { rows } = await pool.query(
      `SELECT id, status FROM candidatos WHERE id = $1`,
      [candidatoId]
    );
    
    if (!rows[0]) {
      return res.status(404).json({ error: "Candidato não encontrado" });
    }
    
    if (rows[0].status !== 'aprovado') {
      return res.status(400).json({ 
        error: "Apenas candidatos aprovados podem ser enviados para admissão",
        message: `O candidato está com status "${rows[0].status}". Aprove o candidato primeiro.`
      });
    }
    
    // Enviar para FGS
    const resultado = await enviarParaFGS(candidatoId);
    
    if (resultado.success) {
      res.json({
        success: true,
        message: resultado.message,
        data: resultado.data,
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado.message,
      });
    }
  } catch (error) {
    console.error("❌ Erro ao enviar candidato para FGS:", error);
    res.status(500).json({ 
      error: "Erro ao enviar candidato para FGS",
      details: (error as Error).message 
    });
  }
});

// Listar candidatos de uma vaga específica
// IMPORTANTE: Esta rota deve vir DEPOIS das rotas específicas (como /:id/enviar-fgs)
candidatosRouter.get("/:vagaId", async (req, res) => {
  const { vagaId } = req.params;
  const { rows } = await pool.query(
    "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id WHERE c.vaga_id = $1 ORDER BY c.data_cadastro DESC",
    [vagaId]
  );
  res.json(rows);
});
