import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

const router = Router();

// Tipos de documento disponíveis
const TIPOS_DOCUMENTO = [
  "foto_3x4",
  "ctps_digital",
  "identidade_frente",
  "identidade_verso",
  "comprovante_residencia",
  "certidao_nascimento_casamento",
  "reservista",
  "titulo_eleitor",
  "antecedentes_criminais",
  "certidao_nascimento_dependente",
  "cpf_dependente",
];

// ==========================================
// RH — GET /documentos/rh/listar
// ==========================================
router.get("/rh/listar", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*,
        c.nome  AS candidato_nome,
        c.email AS candidato_email,
        c.telefone AS candidato_telefone,
        COALESCE(v.titulo, 'Sem vaga') AS vaga_titulo
      FROM documentos_admissao d
      JOIN candidatos c ON c.id = d.candidato_id
      LEFT JOIN vagas v ON v.id = c.vaga_id
      ORDER BY d.criado_em DESC
    `);

    res.json({ documentos: result.rows });
  } catch (err: any) {
    console.error("Erro ao listar documentos:", err);
    res.status(500).json({ error: "Erro ao listar documentos" });
  }
});

// ==========================================
// RH — PUT /documentos/rh/:id/validar
// Valida ou rejeita UM documento específico
// ==========================================
router.put("/rh/:id/validar", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipo_documento, acao, motivo_rejeicao } = req.body as {
      tipo_documento: string;
      acao: "aprovar" | "rejeitar";
      motivo_rejeicao?: string;
    };

    if (!TIPOS_DOCUMENTO.includes(tipo_documento)) {
      return res.status(400).json({ error: "Tipo de documento inválido" });
    }
    if (!["aprovar", "rejeitar"].includes(acao)) {
      return res.status(400).json({ error: "Ação inválida. Use 'aprovar' ou 'rejeitar'" });
    }

    const validado = acao === "aprovar";
    const rejeitado = acao === "rejeitar";

    await pool.query(
      `UPDATE documentos_admissao
       SET
         ${tipo_documento}_validado        = $1,
         ${tipo_documento}_rejeitado       = $2,
         ${tipo_documento}_motivo_rejeicao = $3,
         status = CASE
           WHEN $1 = TRUE OR $2 = TRUE THEN 'em_analise'
           ELSE status
         END,
         data_ultimo_upload = NOW()
       WHERE id = $4`,
      [validado, rejeitado, motivo_rejeicao ?? null, id]
    );

    res.json({ message: `Documento ${acao === "aprovar" ? "aprovado" : "rejeitado"} com sucesso` });
  } catch (err: any) {
    console.error("Erro ao validar documento:", err);
    res.status(500).json({ error: "Erro ao validar documento" });
  }
});

// ==========================================
// RH — PUT /documentos/rh/:id/validar-todos
// Aprova ou rejeita TODOS os documentos enviados
// ==========================================
router.put("/rh/:id/validar-todos", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acao, motivo_rejeicao } = req.body as {
      acao: "aprovar" | "rejeitar";
      motivo_rejeicao?: string;
    };

    if (!["aprovar", "rejeitar"].includes(acao)) {
      return res.status(400).json({ error: "Ação inválida" });
    }

    const validado = acao === "aprovar";
    const rejeitado = acao === "rejeitar";
    const novoStatus = acao === "aprovar" ? "aprovado" : "rejeitado";

    // Constrói SET dinâmico para todos os tipos de documento
    const setClauses = TIPOS_DOCUMENTO.flatMap((tipo) => [
      `${tipo}_validado = $1`,
      `${tipo}_rejeitado = $2`,
      `${tipo}_motivo_rejeicao = CASE WHEN ${tipo}_url IS NOT NULL THEN $3 ELSE NULL END`,
    ]).join(", ");

    await pool.query(
      `UPDATE documentos_admissao
       SET ${setClauses},
           status            = $4,
           data_conclusao    = CASE WHEN $4 IN ('aprovado','rejeitado') THEN NOW() ELSE data_conclusao END,
           data_ultimo_upload = NOW()
       WHERE id = $5`,
      [validado, rejeitado, motivo_rejeicao ?? null, novoStatus, id]
    );

    res.json({ message: `Todos os documentos foram ${acao === "aprovar" ? "aprovados" : "rejeitados"}` });
  } catch (err: any) {
    console.error("Erro ao validar todos os documentos:", err);
    res.status(500).json({ error: "Erro ao validar documentos" });
  }
});

// ==========================================
// PÚBLICO — POST /documentos/login
// Candidato acessa portal com CPF + senha
// ==========================================
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { cpf, senha } = req.body as { cpf: string; senha: string };

    if (!cpf || !senha) {
      return res.status(400).json({ error: "CPF e senha são obrigatórios" });
    }

    // Busca candidato pelo CPF
    const candidatoResult = await pool.query(
      `SELECT c.*, d.id as doc_id, d.senha_hash, d.status as doc_status
       FROM candidatos c
       JOIN documentos_admissao d ON d.candidato_id = c.id
       WHERE REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), '/', '') = $1`,
      [cpf.replace(/\D/g, "")]
    );

    if (candidatoResult.rows.length === 0) {
      return res.status(401).json({ error: "CPF não encontrado ou sem acesso ao portal de documentos" });
    }

    const candidato = candidatoResult.rows[0];

    // Verificar senha
    const senhaOk = await bcrypt.compare(senha, candidato.senha_hash || "");
    if (!senhaOk) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign(
      { sub: candidato.doc_id, candidato_id: candidato.id, tipo: "documentos" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    res.json({ token, nome: candidato.nome });
  } catch (err: any) {
    console.error("Erro no login de documentos:", err);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

// ==========================================
// PÚBLICO — GET /documentos/dados
// Candidato busca seus documentos após login
// ==========================================
router.get("/dados", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (!token) {
      return res.status(401).json({ error: "Token ausente" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret") as any;

    if (payload.tipo !== "documentos") {
      return res.status(403).json({ error: "Token inválido para este portal" });
    }

    const result = await pool.query(
      `SELECT
         d.*,
         c.nome, c.email, c.telefone,
         COALESCE(v.titulo, 'Sem vaga') AS vaga_titulo
       FROM documentos_admissao d
       JOIN candidatos c ON c.id = d.candidato_id
       LEFT JOIN vagas v ON v.id = c.vaga_id
       WHERE d.id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Dados não encontrados" });
    }

    const row = result.rows[0];

    // Formata resposta compatível com o frontend upload.tsx
    const documentos: Record<string, any> = {};
    for (const tipo of TIPOS_DOCUMENTO) {
      documentos[tipo] = {
        url: row[`${tipo}_url`] ?? null,
        validado: row[`${tipo}_validado`] ?? false,
        rejeitado: row[`${tipo}_rejeitado`] ?? false,
        motivo_rejeicao: row[`${tipo}_motivo_rejeicao`] ?? null,
      };
    }
    if (documentos.comprovante_residencia) {
      documentos.comprovante_residencia.data_emissao = row.comprovante_residencia_data_emissao ?? null;
    }

    res.json({
      candidato: {
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        vaga: row.vaga_titulo,
      },
      documentos,
      status: row.status,
    });
  } catch (err: any) {
    console.error("Erro ao buscar dados de documentos:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

export default router;
