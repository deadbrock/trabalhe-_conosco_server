import { Router } from "express";
import multer from "multer";
import * as cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { pool } from "../db";

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

// Listar candidatos de uma vaga específica
candidatosRouter.get("/:vagaId", async (req, res) => {
  const { vagaId } = req.params;
  const { rows } = await pool.query(
    "SELECT c.*, v.titulo as vaga_titulo FROM candidatos c LEFT JOIN vagas v ON c.vaga_id = v.id WHERE c.vaga_id = $1 ORDER BY c.data_cadastro DESC",
    [vagaId]
  );
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
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("❌ Erro ao processar candidatura:", error);
    res.status(500).json({ error: "Erro ao processar candidatura", details: (error as Error).message });
  }
});

candidatosRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  const { rows } = await pool.query(
    `UPDATE candidatos SET status = COALESCE($1, status) WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Candidato não encontrado" });
  res.json(rows[0]);
});
