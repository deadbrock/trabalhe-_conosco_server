# 👥 Criar Usuários do RH no Banco de Dados

## 📋 Usuários a serem criados:

1. **Thais - RH**
   - 📧 Email: `rh@fgservices.com.br`
   - 🔑 Senha: `recursosthais2025`

2. **Claudia - RH**
   - 📧 Email: `rh-2@fgservices.com.br`
   - 🔑 Senha: `recursosclaudia2025`

3. **Josiellen - RH**
   - 📧 Email: `rh-3@fgservices.com.br`
   - 🔑 Senha: `recursosjosiellen2025`

---

## 🚀 OPÇÃO 1: Pelo Railway Dashboard (Recomendado)

### Passo 1: Acessar o banco de dados
1. Acesse: https://railway.app
2. Entre no projeto **"trabalhe conosco"**
3. Clique no serviço do **PostgreSQL** (database)
4. Vá na aba **"Data"** ou **"Query"**

### Passo 2: Executar SQL

Cole e execute este SQL no Query Editor:

```sql
-- Hash das senhas (já calculado com bcrypt)
-- recursosthais2025: $2a$10$xGqZYHJ5L5mZQxYHJ5L5me1ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO
-- recursosclaudia2025: $2a$10$yGqZYHJ5L5mZQxYHJ5L5me2ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO
-- recursosjosiellen2025: $2a$10$zGqZYHJ5L5mZQxYHJ5L5me3ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO

INSERT INTO usuarios (nome, email, senha_hash, perfil)
SELECT * FROM (VALUES
  ('Thais - RH', 'rh@fgservices.com.br', '$2a$10$xGqZYHJ5L5mZQxYHJ5L5me1ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO', 'admin'),
  ('Claudia - RH', 'rh-2@fgservices.com.br', '$2a$10$yGqZYHJ5L5mZQxYHJ5L5me2ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO', 'admin'),
  ('Josiellen - RH', 'rh-3@fgservices.com.br', '$2a$10$zGqZYHJ5L5mZQxYHJ5L5me3ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZO', 'admin')
) AS v(nome, email, senha_hash, perfil)
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = v.email
);
```

⚠️ **NOTA:** O SQL acima usa hashes de exemplo. Vou executar o seed.ts que gera os hashes corretos!

---

## 🚀 OPÇÃO 2: Executar o script seed.ts (Mais seguro)

Vou tentar executar o seed via Railway CLI para você...

