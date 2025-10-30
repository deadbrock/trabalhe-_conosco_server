# 🔧 Como Configurar o Arquivo .env

## 📍 **ONDE ENCONTRAR AS CREDENCIAIS**

O arquivo `.env` foi criado em `server/.env` e precisa ser preenchido com suas credenciais reais.

---

## 🗄️ **1. DATABASE_URL (Railway)**

### **Onde encontrar:**
1. Acesse: https://railway.app/
2. Faça login
3. Selecione seu projeto: **trabalhe-conoscoserver**
4. Clique na aba **Postgres**
5. Vá em **Variables** ou **Connect**
6. Copie a `DATABASE_URL` completa

### **Formato:**
```
DATABASE_URL=postgresql://postgres:SENHA@containers-us-west-XXX.railway.app:PORTA/railway
```

### **Como preencher no .env:**
Abra o arquivo `server/.env` e cole a URL completa:
```bash
DATABASE_URL=postgresql://postgres:sua_senha_aqui@containers-us-west-123.railway.app:6789/railway
```

---

## ☁️ **2. CLOUDINARY (Upload de Currículos)**

### **Onde encontrar:**
1. Acesse: https://cloudinary.com/
2. Faça login
3. No **Dashboard**, você verá:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### **Como preencher no .env:**
```bash
CLOUDINARY_CLOUD_NAME=seu_cloud_name_aqui
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

## 🔐 **3. JWT_SECRET**

Já está configurado automaticamente:
```bash
JWT_SECRET=fgservices_super_secret_key_2024_trabalhe_conosco
```

✅ **Não precisa alterar!**

---

## 📝 **EXEMPLO DE .env PREENCHIDO**

```bash
PORT=3333
JWT_SECRET=fgservices_super_secret_key_2024_trabalhe_conosco
DATABASE_URL=postgresql://postgres:SuaSenha123@containers-us-west-99.railway.app:5432/railway
CLOUDINARY_CLOUD_NAME=djbvjlw1m
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

## ⚡ **COMO ABRIR E EDITAR O ARQUIVO .env**

### **No VS Code:**
1. Abra o VS Code
2. Navegue para `server/.env`
3. Cole suas credenciais
4. Salve (Ctrl+S)

### **No Bloco de Notas:**
```bash
notepad server\.env
```

### **No Cursor:**
- O arquivo `.env` está em: `trabalhe-_conosco/server/.env`
- Abra e edite diretamente

---

## ✅ **CHECKLIST**

Antes de rodar a migração, verifique:

- [ ] Arquivo `.env` existe em `server/.env`
- [ ] `DATABASE_URL` está preenchida (Railway)
- [ ] `CLOUDINARY_CLOUD_NAME` está preenchido
- [ ] `CLOUDINARY_API_KEY` está preenchido
- [ ] `CLOUDINARY_API_SECRET` está preenchido
- [ ] `JWT_SECRET` está configurado (já vem pronto)

---

## 🚀 **DEPOIS DE CONFIGURAR**

Execute a migração:
```bash
cd server
npm run migrate:fase1
```

Se tudo estiver correto, você verá:
```
✅ Migração FASE 1 concluída com sucesso!
🎉 Banco de dados atualizado!
```

---

## 🐛 **TROUBLESHOOTING**

### **Erro: "client password must be a string"**
❌ **Problema:** DATABASE_URL está vazia ou incorreta  
✅ **Solução:** Copie a URL completa do Railway

### **Erro: "injecting env (0) from .env"**
❌ **Problema:** Arquivo .env está vazio  
✅ **Solução:** Preencha todas as variáveis

### **Erro: "Invalid Cloudinary credentials"**
❌ **Problema:** Credenciais do Cloudinary incorretas  
✅ **Solução:** Copie novamente do dashboard Cloudinary

---

## 📞 **PRECISA DE AJUDA?**

Se não conseguir encontrar alguma credencial:
1. Para **Railway**: Verifique o email de registro ou recupere acesso
2. Para **Cloudinary**: Acesse cloudinary.com/console

---

**⚠️ IMPORTANTE:**
- **NUNCA** commite o arquivo `.env` no Git
- **NUNCA** compartilhe suas credenciais
- O arquivo `.env` já está no `.gitignore` por segurança

