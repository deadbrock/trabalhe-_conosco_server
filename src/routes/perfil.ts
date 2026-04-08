import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { pool } from "../db";

const router = Router();

// Multer: memória para foto de perfil (upload posterior para Cloudinary se configurado)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Apenas imagens são permitidas"));
    }
    cb(null, true);
  },
});

// ==========================================
// GET /perfil  — dados do usuário logado
// ==========================================
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub;

    const result = await pool.query(
      `SELECT
         id, nome, email, perfil, filial_id,
         telefone, cargo, foto_perfil,
         criado_em, data_atualizacao
       FROM usuarios
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    // Colunas ainda não existem (migration pendente) → retorna dados básicos do JWT
    if (err.code === "42703") {
      const user = (req as any).user;
      return res.json({
        id: user?.sub,
        nome: user?.nome,
        email: user?.email,
        perfil: user?.perfil,
        filial_id: user?.filial_id,
        telefone: null,
        cargo: null,
        foto_perfil: null,
        criado_em: null,
        data_atualizacao: null,
      });
    }
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
});

// ==========================================
// PUT /perfil  — atualizar nome, telefone, cargo
// ==========================================
router.put("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub;
    const { nome, telefone, cargo } = req.body as {
      nome?: string;
      telefone?: string | null;
      cargo?: string | null;
    };

    if (!nome || nome.trim().length < 3) {
      return res.status(400).json({ error: "Nome deve ter pelo menos 3 caracteres" });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET
         nome             = $1,
         telefone         = $2,
         cargo            = $3,
         data_atualizacao = NOW()
       WHERE id = $4
       RETURNING id, nome, email, perfil, filial_id, telefone, cargo, foto_perfil, criado_em, data_atualizacao`,
      [nome.trim(), telefone ?? null, cargo ?? null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

// ==========================================
// PUT /perfil/senha  — alterar senha
// ==========================================
router.put("/senha", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub;
    const { senhaAtual, novaSenha } = req.body as {
      senhaAtual: string;
      novaSenha: string;
    };

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
    }

    const userResult = await pool.query(
      "SELECT senha_hash FROM usuarios WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, userResult.rows[0].senha_hash);
    if (!senhaCorreta) {
      return res.status(400).json({ error: "Senha atual incorreta" });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(
      "UPDATE usuarios SET senha_hash = $1, data_atualizacao = NOW() WHERE id = $2",
      [novaSenhaHash, userId]
    );

    res.json({ message: "Senha alterada com sucesso" });
  } catch (err: any) {
    console.error("Erro ao alterar senha:", err);
    res.status(500).json({ error: "Erro ao alterar senha" });
  }
});

// ==========================================
// POST /perfil/foto  — upload de foto de perfil
// ==========================================
router.post("/foto", upload.single("foto"), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub;

    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    let fotoUrl: string;

    if (cloudName && apiKey && apiSecret) {
      // Upload para Cloudinary
      const cloudinary = await import("cloudinary");
      cloudinary.v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

      const b64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${b64}`;

      const uploadResult = await cloudinary.v2.uploader.upload(dataUri, {
        folder: "rh-perfil",
        public_id: `usuario_${userId}`,
        overwrite: true,
        transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }],
      });

      fotoUrl = uploadResult.secure_url;
    } else {
      // Fallback: base64 inline (sem Cloudinary configurado)
      const b64 = req.file.buffer.toString("base64");
      fotoUrl = `data:${req.file.mimetype};base64,${b64}`;
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET foto_perfil = $1, data_atualizacao = NOW()
       WHERE id = $2
       RETURNING id, nome, email, perfil, filial_id, telefone, cargo, foto_perfil, criado_em, data_atualizacao`,
      [fotoUrl, userId]
    );

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Erro ao fazer upload de foto:", err);
    res.status(500).json({ error: "Erro ao fazer upload da foto" });
  }
});

// ==========================================
// DELETE /perfil/foto  — remover foto de perfil
// ==========================================
router.delete("/foto", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub;

    const result = await pool.query(
      `UPDATE usuarios
       SET foto_perfil = NULL, data_atualizacao = NOW()
       WHERE id = $1
       RETURNING id, nome, email, perfil, filial_id, telefone, cargo, foto_perfil, criado_em, data_atualizacao`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Erro ao remover foto:", err);
    res.status(500).json({ error: "Erro ao remover foto" });
  }
});

export default router;
