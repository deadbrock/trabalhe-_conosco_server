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
    const originalName = file.originalname.replace(/\.[^/.]+$/, "");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return {
      folder: "curriculos",
      public_id: `${sanitizedName}_${Date.now()}.pdf`,
      resource_type: "raw" as const,
      access_mode: "public" as const,
      use_filename: false,
      unique_filename: false,
    };
  },
});

const upload = multer({ storage: storage });
export const candidatosRouter = Router();

// Listar todos os candidatos (com filtros opcionais) — protegida, filtra por filial
candidatosRouter.get("/", async (req, res) => {
  const filialId: number = (req as any).user?.filial_id || 1;
  const { status } = req.query as { status?: string };

  let query =
    "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id WHERE c.filial_id = $1";
  const params: any[] = [filialId];

  if (status && status !== "all") {
    params.push(status);
    query += ` AND c.status = $${params.length}`;
  }

  query += " ORDER BY c.data_cadastro DESC";

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Candidatura pública — filial_id derivado da vaga
candidatosRouter.post("/", upload.single("curriculo"), async (req, res) => {
  try {
    const { nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, vaga_id } = req.body;

    // Verificar candidatura duplicada
    const { rows: existing } = await pool.query(
      `SELECT id FROM candidatos WHERE cpf = $1 AND vaga_id = $2`,
      [cpf, vaga_id]
    );

    if (existing.length > 0) {
      console.log("⚠️ Candidatura duplicada bloqueada:", { cpf, vaga_id });
      return res.status(400).json({
        error: "Você já se candidatou para esta vaga!",
        message: "Não é possível se candidatar novamente para a mesma vaga. Escolha outra vaga disponível.",
      });
    }

    // Determinar filial_id a partir da vaga
    let filialId = 1;
    if (vaga_id) {
      const vagaResult = await pool.query("SELECT filial_id FROM vagas WHERE id = $1", [vaga_id]);
      if (vagaResult.rows.length > 0 && vagaResult.rows[0].filial_id) {
        filialId = vagaResult.rows[0].filial_id;
      }
    }

    // Processar URL do Cloudinary
    const cloudinaryFile = req.file as any;
    let curriculoUrl = null;

    if (cloudinaryFile) {
      if (cloudinaryFile.path && cloudinaryFile.path.startsWith("http")) {
        curriculoUrl = cloudinaryFile.path;
      } else {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const publicId = cloudinaryFile.filename || cloudinaryFile.public_id;
        if (cloudName && publicId) {
          curriculoUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`;
        }
      }
    }

    console.log("📤 Upload recebido:", {
      filename: req.file?.originalname,
      cloudinary_url: curriculoUrl,
      cloudinary_file: cloudinaryFile,
      size: req.file?.size,
    });

    const { rows } = await pool.query(
      `INSERT INTO candidatos (nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculo, vaga_id, filial_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [nome, cpf, data_nascimento, email, telefone, estado, cidade, bairro, curriculoUrl, vaga_id, filialId]
    );

    console.log("✅ Candidato salvo com sucesso:", rows[0].id, "| URL:", curriculoUrl, "| Filial:", filialId);

    const candidato = rows[0];
    notificarInscricao(candidato.id, candidato.vaga_id, filialId).catch((err) => {
      console.error("❌ Erro ao disparar gatilho de inscrição:", err);
    });

    res.status(201).json(candidato);
  } catch (error) {
    console.error("❌ Erro ao processar candidatura:", error);
    res.status(500).json({ error: "Erro ao processar candidatura", details: (error as Error).message });
  }
});

candidatosRouter.put("/:id", async (req, res) => {
  try {
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const { rows } = await pool.query(
      `UPDATE candidatos SET status = COALESCE($1, status) WHERE id = $2 AND filial_id = $3 RETURNING *`,
      [status, id, filialId]
    );

    if (!rows[0]) return res.status(404).json({ error: "Candidato não encontrado" });

    const candidato = rows[0];

    if (status) {
      switch (status) {
        case "Em análise":
          notificarEmAnalise(candidato.id, candidato.vaga_id, filialId).catch((err) => {
            console.error('❌ Erro ao disparar gatilho "Em análise":', err);
          });
          break;
        case "Pré-selecionado":
          notificarPreSelecionado(candidato.id, candidato.vaga_id, filialId).catch((err) => {
            console.error('❌ Erro ao disparar gatilho "Pré-selecionado":', err);
          });
          break;
        case "Aprovado":
          notificarAprovado(candidato.id, candidato.vaga_id, filialId).catch((err) => {
            console.error('❌ Erro ao disparar gatilho "Aprovado":', err);
          });
          break;
        case "Reprovado":
          notificarReprovado(candidato.id, candidato.vaga_id, filialId).catch((err) => {
            console.error('❌ Erro ao disparar gatilho "Reprovado":', err);
          });
          break;
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
    const filialId: number = (req as any).user?.filial_id || 1;
    const { id } = req.params;
    const candidatoId = parseInt(id);

    if (isNaN(candidatoId)) {
      return res.status(400).json({ error: "ID do candidato inválido" });
    }

    const { rows } = await pool.query(
      `SELECT id, status FROM candidatos WHERE id = $1 AND filial_id = $2`,
      [candidatoId, filialId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Candidato não encontrado" });
    }

    if (rows[0].status !== "aprovado") {
      return res.status(400).json({
        error: "Apenas candidatos aprovados podem ser enviados para admissão",
        message: `O candidato está com status "${rows[0].status}". Aprove o candidato primeiro.`,
      });
    }

    const resultado = await enviarParaFGS(candidatoId);

    if (resultado.success) {
      res.json({ success: true, message: resultado.message, data: resultado.data });
    } else {
      res.status(500).json({ success: false, error: resultado.message });
    }
  } catch (error) {
    console.error("❌ Erro ao enviar candidato para FGS:", error);
    res.status(500).json({
      error: "Erro ao enviar candidato para FGS",
      details: (error as Error).message,
    });
  }
});

// Listar candidatos de uma vaga específica
// IMPORTANTE: Esta rota deve vir DEPOIS das rotas específicas (como /:id/enviar-fgs)
candidatosRouter.get("/:vagaId", async (req, res) => {
  const filialId: number = (req as any).user?.filial_id || 1;
  const { vagaId } = req.params;
  const { rows } = await pool.query(
    `SELECT c.*, v.titulo as vaga_titulo
     FROM candidatos c
     LEFT JOIN vagas v ON c.vaga_id = v.id
     WHERE c.vaga_id = $1 AND c.filial_id = $2
     ORDER BY c.data_cadastro DESC`,
    [vagaId, filialId]
  );
  res.json(rows);
});
