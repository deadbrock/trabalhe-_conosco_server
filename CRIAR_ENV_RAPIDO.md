# 🚀 Criar Arquivo .env - RÁPIDO

## ⚡ Passo a Passo Rápido:

### 1. **Crie o arquivo .env** (copie e cole no PowerShell):

```powershell
cd C:\Users\Souza\OneDrive\Documentos\trabalheconoscofg\trabalhe-_conosco_server

@"
# 🔧 Configuração do Ambiente - Sistema Astron

# ========================================
# 🗄️ BANCO DE DADOS (Railway) - OBRIGATÓRIO
# ========================================
DATABASE_URL=

# ========================================
# 🔐 AUTENTICAÇÃO JWT - OBRIGATÓRIO
# ========================================
JWT_SECRET=fgservices_super_secret_key_2024_trabalhe_conosco

# ========================================
# ☁️ CLOUDINARY (Upload) - OBRIGATÓRIO
# ========================================
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ========================================
# 📧 SENDGRID (Email) - OPCIONAL
# ========================================
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=naoresponder@fgservices.com.br

# ========================================
# 📱 TWILIO (WhatsApp) - OPCIONAL
# ========================================
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ========================================
# ⚙️ SERVIDOR
# ========================================
PORT=3333
NODE_ENV=development
"@ | Out-File -FilePath .env -Encoding utf8
```

---

### 2. **Preencha as credenciais OBRIGATÓRIAS:**

Abra o arquivo `.env` que acabou de criar e preencha:

#### 🗄️ **DATABASE_URL** (Railway):
1. Acesse: https://railway.app/
2. Projeto: `trabalhe-conoscoserver`
3. Clique em **Postgres**
4. Copie a `DATABASE_URL` completa

**Exemplo:**
```
DATABASE_URL=postgresql://postgres:SuaSenha@containers-us-west-123.railway.app:5432/railway
```

#### ☁️ **CLOUDINARY**:
1. Acesse: https://cloudinary.com/console
2. No Dashboard, copie:
   - Cloud Name
   - API Key
   - API Secret

**Exemplo:**
```
CLOUDINARY_CLOUD_NAME=djbvjlw1m
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVw
```

---

### 3. **Salve o arquivo .env** (Ctrl+S)

---

### 4. **Reinicie o servidor:**

```powershell
# Pare o servidor (Ctrl+C)
# Depois rode novamente:
npm run dev
```

---

## ✅ **Como saber se está funcionando:**

Quando rodar `npm run dev`, você deve ver:

```
🚀 API v1.3.2 listening on http://localhost:3333
✅ Tabela documentos_candidatos já existe
```

**SEM** erros de conexão!

---

## 🐛 **Troubleshooting:**

### ❌ Erro: "injecting env (0) from .env"
**Problema:** Arquivo .env está vazio ou não existe  
**Solução:** Execute o comando do Passo 1 novamente

### ❌ Erro: "ECONNREFUSED ::1:5432"
**Problema:** DATABASE_URL não está preenchida  
**Solução:** Preencha a DATABASE_URL do Railway

### ❌ Erro: "Invalid Cloudinary credentials"
**Problema:** Credenciais do Cloudinary incorretas  
**Solução:** Verifique se copiou corretamente do dashboard

---

## 📝 **Exemplo de .env PREENCHIDO:**

```bash
DATABASE_URL=postgresql://postgres:xyz123@containers-us-west-99.railway.app:5432/railway
JWT_SECRET=fgservices_super_secret_key_2024_trabalhe_conosco
CLOUDINARY_CLOUD_NAME=djbvjlw1m
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=naoresponder@fgservices.com.br
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
PORT=3333
NODE_ENV=development
```

---

## ⚠️ **IMPORTANTE:**
- **SendGrid** e **Twilio** são OPCIONAIS para testes locais
- Apenas **DATABASE_URL** e **CLOUDINARY** são OBRIGATÓRIOS
- O sistema vai funcionar sem email e WhatsApp para testes

---

**Depois de configurar, teste o login no frontend!** 🎄

