import { Router, Request, Response } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import multer from "multer";
import * as cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

export const perfilRouter = Router();

// Configurar Cloudinary
const cld = cloudinary.v2;
cld.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configurar storage do Multer com Cloudinary para fotos de perfil
const storage = new CloudinaryStorage({
  cloudinary: cld,
  params: async (req, file) => {
    return {
      folder: "perfil_rh",
      public_id: `usuario_${(req as any).user?.id}_${Date.now()}`,
      resource_type: "image" as const,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto:good" },
        { fetch_format: "auto" }
      ],
      access_mode: "public" as const,
    };
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  }
});

// GET /perfil - Obter dados do perfil do usuário logado
perfilRouter.get("/", async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { rows } = await pool.query(
      `SELECT id, nome, email, perfil, foto_perfil, telefone, cargo, criado_em, data_atualizacao 
       FROM usuarios 
       WHERE id = $1`,
      [usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const usuario = rows[0];
    
    // Não retornar senha_hash
    res.json(usuario);
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
});

// PUT /perfil - Atualizar dados do perfil
perfilRouter.put("/", async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const { nome, telefone, cargo } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Validações
    if (nome && nome.trim().length < 3) {
      return res.status(400).json({ error: "Nome deve ter pelo menos 3 caracteres" });
    }

    const { rows } = await pool.query(
      `UPDATE usuarios 
       SET 
         nome = COALESCE($1, nome),
         telefone = COALESCE($2, telefone),
         cargo = COALESCE($3, cargo),
         data_atualizacao = NOW()
       WHERE id = $4 
       RETURNING id, nome, email, perfil, foto_perfil, telefone, cargo, data_atualizacao`,
      [nome, telefone, cargo, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    console.log(`✅ Perfil atualizado: Usuário ${usuarioId} - ${nome || 'sem alteração de nome'}`);
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

// POST /perfil/foto - Upload de foto de perfil
perfilRouter.post("/foto", upload.single("foto"), async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma foto foi enviada" });
    }

    const cloudinaryFile = req.file as any;
    let fotoUrl = cloudinaryFile.path;

    // Se não for URL completa, construir
    if (!fotoUrl || !fotoUrl.startsWith('http')) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const publicId = cloudinaryFile.filename || cloudinaryFile.public_id;
      
      if (cloudName && publicId) {
        fotoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
      }
    }

    console.log("📸 Upload de foto recebido:", {
      filename: req.file.originalname,
      cloudinary_url: fotoUrl,
      size: req.file.size,
      usuario_id: usuarioId
    });

    // Buscar foto antiga para deletar
    const { rows: oldData } = await pool.query(
      "SELECT foto_perfil FROM usuarios WHERE id = $1",
      [usuarioId]
    );

    // Atualizar no banco
    const { rows } = await pool.query(
      `UPDATE usuarios 
       SET foto_perfil = $1, data_atualizacao = NOW() 
       WHERE id = $2 
       RETURNING id, nome, email, perfil, foto_perfil, telefone, cargo`,
      [fotoUrl, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Deletar foto antiga do Cloudinary (se existir e for do Cloudinary)
    if (oldData[0]?.foto_perfil && oldData[0].foto_perfil.includes('cloudinary.com')) {
      try {
        const urlParts = oldData[0].foto_perfil.split('/upload/');
        if (urlParts.length > 1) {
          let publicId = urlParts[1];
          // Remover extensão
          publicId = publicId.replace(/\.[^/.]+$/, '');
          
          await cld.uploader.destroy(publicId);
          console.log(`🗑️ Foto antiga deletada: ${publicId}`);
        }
      } catch (deleteError) {
        console.warn("⚠️ Erro ao deletar foto antiga:", deleteError);
        // Não bloquear o upload se falhar ao deletar foto antiga
      }
    }

    console.log(`✅ Foto de perfil atualizada: Usuário ${usuarioId}`);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Erro ao fazer upload de foto:", error);
    res.status(500).json({ error: "Erro ao fazer upload de foto" });
  }
});

// DELETE /perfil/foto - Remover foto de perfil
perfilRouter.delete("/foto", async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Buscar foto atual
    const { rows: oldData } = await pool.query(
      "SELECT foto_perfil FROM usuarios WHERE id = $1",
      [usuarioId]
    );

    // Remover do banco
    const { rows } = await pool.query(
      `UPDATE usuarios 
       SET foto_perfil = NULL, data_atualizacao = NOW() 
       WHERE id = $1 
       RETURNING id, nome, email, perfil, foto_perfil, telefone, cargo`,
      [usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Deletar do Cloudinary (se existir)
    if (oldData[0]?.foto_perfil && oldData[0].foto_perfil.includes('cloudinary.com')) {
      try {
        const urlParts = oldData[0].foto_perfil.split('/upload/');
        if (urlParts.length > 1) {
          let publicId = urlParts[1];
          publicId = publicId.replace(/\.[^/.]+$/, '');
          
          await cld.uploader.destroy(publicId);
          console.log(`🗑️ Foto deletada do Cloudinary: ${publicId}`);
        }
      } catch (deleteError) {
        console.warn("⚠️ Erro ao deletar foto do Cloudinary:", deleteError);
      }
    }

    console.log(`✅ Foto de perfil removida: Usuário ${usuarioId}`);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Erro ao remover foto:", error);
    res.status(500).json({ error: "Erro ao remover foto" });
  }
});

// PUT /perfil/senha - Alterar senha
perfilRouter.put("/senha", async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const { senhaAtual, novaSenha } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
    }

    // Buscar usuário e verificar senha atual
    const { rows } = await pool.query(
      "SELECT id, senha_hash FROM usuarios WHERE id = $1",
      [usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const usuario = rows[0];

    // Verificar senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }

    // Hash da nova senha
    const novoHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha
    await pool.query(
      `UPDATE usuarios 
       SET senha_hash = $1, data_atualizacao = NOW() 
       WHERE id = $2`,
      [novoHash, usuarioId]
    );

    console.log(`✅ Senha alterada: Usuário ${usuarioId}`);
    res.json({ message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao alterar senha:", error);
    res.status(500).json({ error: "Erro ao alterar senha" });
  }
});

